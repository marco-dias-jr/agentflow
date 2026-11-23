import {
  EmailSender,
  SendResetCodeEmailInput,
} from "../../application/ports/EmailSender";

export class ResendOrConsoleEmailSender implements EmailSender {
  public async sendPasswordResetCode(
    input: SendResetCodeEmailInput
  ): Promise<void> {
    const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
    const fromAddress = (
      process.env.EMAIL_FROM ?? "AgentFlow <onboarding@resend.dev>"
    ).trim();

    if (!apiKey) {
      console.log(
        `[AUTH][DEV-EMAIL] Password reset code for ${input.toEmail} (${input.fullName}): ${input.code} (expires in ${input.expiresInMinutes}m)`
      );
      return;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.toEmail],
        subject: "AgentFlow — Password Reset Verification Code",
        text: `Hello ${input.fullName},\n\nYour AgentFlow password reset verification code is: ${input.code}\n\nThis code expires in ${input.expiresInMinutes} minutes. If you did not request this, you can safely ignore this email.`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to send verification email (${response.status}): ${errorText}`
      );
    }
  }
}
