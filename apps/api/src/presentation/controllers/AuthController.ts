import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { LoginUser } from "../../application/use-cases/auth/LoginUser";
import { RegisterUser } from "../../application/use-cases/auth/RegisterUser";
import { RequestPasswordReset } from "../../application/use-cases/auth/RequestPasswordReset";
import { ResetPassword } from "../../application/use-cases/auth/ResetPassword";
import { AuthRepository } from "../../domain/repositories/AuthRepository";
import { Cpf } from "../../domain/value-objects/Cpf";
import { InMemoryRateLimiter } from "../../infrastructure/security/InMemoryRateLimiter";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../dto/AuthDtos";
import {
  AUTH_REPOSITORY_TOKEN,
  AuthenticatedRequest,
  AuthGuard,
} from "../security/AuthGuard";
import {
  clearSessionCookie,
  setSessionCookie,
} from "../security/SessionCookie";

export const REGISTER_USER_USE_CASE_TOKEN = Symbol("REGISTER_USER_USE_CASE_TOKEN");
export const LOGIN_USER_USE_CASE_TOKEN = Symbol("LOGIN_USER_USE_CASE_TOKEN");
export const REQUEST_RESET_USE_CASE_TOKEN = Symbol("REQUEST_RESET_USE_CASE_TOKEN");
export const RESET_PASSWORD_USE_CASE_TOKEN = Symbol("RESET_PASSWORD_USE_CASE_TOKEN");

@Controller("auth")
export class AuthController {
  private readonly rateLimiter = new InMemoryRateLimiter();

  constructor(
    @Inject(REGISTER_USER_USE_CASE_TOKEN)
    private readonly registerUserUseCase: RegisterUser,
    @Inject(LOGIN_USER_USE_CASE_TOKEN)
    private readonly loginUserUseCase: LoginUser,
    @Inject(REQUEST_RESET_USE_CASE_TOKEN)
    private readonly requestPasswordResetUseCase: RequestPasswordReset,
    @Inject(RESET_PASSWORD_USE_CASE_TOKEN)
    private readonly resetPasswordUseCase: ResetPassword,
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: AuthRepository
  ) {}

  private enforceRateLimit(req: Request, scope: string, max: number, windowMs: number): void {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const allowed = this.rateLimiter.check(`${scope}:${ip}`, max, windowMs);
    if (!allowed) {
      throw new HttpException(
        "Too many attempts. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  @Post("register")
  public async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    this.enforceRateLimit(req, "register", 5, 15 * 60 * 1000);

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid registration data",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const user = await this.registerUserUseCase.execute(parsed.data);
      const session = await this.loginUserUseCase.execute({
        email: user.email,
        password: parsed.data.password,
        userAgent: req.headers["user-agent"] ?? null,
        ipAddress: req.ip ?? null,
      });

      setSessionCookie(res, session.rawSessionToken, session.expiresAt);
      console.log(`[AUTH] Registered user ${user.id} (${user.email})`);

      return {
        data: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          cpf: Cpf.create(user.cpf).formatMasked(),
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Registration failed.";
      throw new BadRequestException(message);
    }
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    this.enforceRateLimit(req, "login", 10, 15 * 60 * 1000);

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid login payload",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const session = await this.loginUserUseCase.execute({
        email: parsed.data.email,
        password: parsed.data.password,
        userAgent: req.headers["user-agent"] ?? null,
        ipAddress: req.ip ?? null,
      });

      setSessionCookie(res, session.rawSessionToken, session.expiresAt);
      console.log(`[AUTH] Login succeeded for ${session.user.email}`);

      return {
        data: {
          id: session.user.id,
          fullName: session.user.fullName,
          email: session.user.email,
          cpf: Cpf.create(session.user.cpf).formatMasked(),
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid email or password.";
      throw new UnauthorizedException(message);
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  public async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    if (req.user?.sessionId) {
      await this.authRepository.revokeSessionById(req.user.sessionId);
    }
    clearSessionCookie(res);
  }

  @Get("me")
  @UseGuards(AuthGuard)
  public me(@Req() req: AuthenticatedRequest) {
    const user = req.user!;
    return {
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        cpf: Cpf.create(user.cpf).formatMasked(),
      },
    };
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  public async forgotPassword(@Body() body: unknown, @Req() req: Request) {
    this.enforceRateLimit(req, "forgot", 4, 15 * 60 * 1000);

    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Valid email address is required.");
    }

    await this.requestPasswordResetUseCase.execute(parsed.data.email);

    return {
      data: {
        message:
          "If an account exists for that email, a 6-digit verification code has been sent.",
      },
    };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  public async resetPassword(@Body() body: unknown, @Req() req: Request) {
    this.enforceRateLimit(req, "reset", 8, 15 * 60 * 1000);

    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid reset password payload",
        issues: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      await this.resetPasswordUseCase.execute(parsed.data);
      console.log(`[AUTH] Password reset completed for ${parsed.data.email}`);
      return {
        data: {
          message: "Password updated successfully. Please sign in.",
        },
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Invalid or expired verification code.";
      throw new BadRequestException(message);
    }
  }
}
