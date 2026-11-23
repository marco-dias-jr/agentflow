import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthRepository } from "../../domain/repositories/AuthRepository";
import { UserRepository } from "../../domain/repositories/UserRepository";
import { TokenSecurity } from "../../infrastructure/security/TokenSecurity";
import { extractSessionToken } from "./SessionCookie";

export const AUTH_REPOSITORY_TOKEN = Symbol("AUTH_REPOSITORY_TOKEN");
export const USER_REPOSITORY_TOKEN = Symbol("USER_REPOSITORY_TOKEN");
export const TOKEN_SECURITY_TOKEN = Symbol("TOKEN_SECURITY_TOKEN");

export interface AuthenticatedUserContext {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: AuthRepository,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepository,
    @Inject(TOKEN_SECURITY_TOKEN)
    private readonly tokenSecurity: TokenSecurity
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = extractSessionToken(req);

    if (!rawToken) {
      throw new UnauthorizedException("Authentication required.");
    }

    const tokenHash = this.tokenSecurity.hashSessionToken(rawToken);
    const session = await this.authRepository.findActiveSessionByTokenHash(
      tokenHash
    );
    if (!session) {
      throw new UnauthorizedException("Session expired or invalid.");
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException("Account not found.");
    }

    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      cpf: user.cpf,
      sessionId: session.id,
    };

    return true;
  }
}
