export class Cpf {
  public readonly value: string;

  private constructor(digits: string) {
    this.value = digits;
  }

  public static create(raw: string): Cpf {
    const digits = Cpf.sanitize(raw);
    if (!Cpf.isValid(digits)) {
      throw new Error("Invalid CPF number.");
    }
    return new Cpf(digits);
  }

  public static sanitize(raw: string): string {
    return raw.replace(/\D/g, "");
  }

  public static isValid(raw: string): boolean {
    const digits = Cpf.sanitize(raw);
    if (digits.length !== 11) {
      return false;
    }

    if (/^(\d)\1{10}$/.test(digits)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      sum += Number(digits[i]) * (10 - i);
    }
    let firstCheck = (sum * 10) % 11;
    if (firstCheck === 10) firstCheck = 0;
    if (firstCheck !== Number(digits[9])) {
      return false;
    }

    sum = 0;
    for (let i = 0; i < 10; i += 1) {
      sum += Number(digits[i]) * (11 - i);
    }
    let secondCheck = (sum * 10) % 11;
    if (secondCheck === 10) secondCheck = 0;
    if (secondCheck !== Number(digits[10])) {
      return false;
    }

    return true;
  }

  public formatMasked(): string {
    return this.value.replace(
      /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
      "$1.$2.$3-$4"
    );
  }
}
