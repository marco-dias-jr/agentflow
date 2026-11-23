export interface SendResetCodeEmailInput {
  toEmail: string;
  fullName: string;
  code: string;
  expiresInMinutes: number;
}

export interface EmailSender {
  sendPasswordResetCode(input: SendResetCodeEmailInput): Promise<void>;
}
