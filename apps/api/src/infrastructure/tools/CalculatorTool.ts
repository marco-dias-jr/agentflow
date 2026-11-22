import { ToolDefinition } from "../../application/ports/LLMProvider";
import { AgentTool } from "./AgentTool";

export class CalculatorTool implements AgentTool {
  public readonly definition: ToolDefinition = {
    name: "calculator",
    description:
      "Evaluates basic arithmetic expressions supporting +, -, *, /, parentheses, and decimal numbers.",
    parameters: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Arithmetic expression to evaluate, e.g. '(120 * 0.15) + 45'",
        },
      },
      required: ["expression"],
    },
  };

  public async execute(args: Record<string, unknown>): Promise<{
    expression: string;
    result: number;
  }> {
    const rawExpression = args.expression;
    if (typeof rawExpression !== "string" || !rawExpression.trim()) {
      throw new Error("Invalid argument: 'expression' must be a non-empty string.");
    }

    const expression = rawExpression.trim();
    const result = this.evaluateSafely(expression);

    return {
      expression,
      result,
    };
  }

  private evaluateSafely(expression: string): number {
    // Allow only digits, whitespace, decimal points, parentheses, and basic arithmetic operators
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      throw new Error("Expression contains unsupported characters.");
    }

    const tokens = this.tokenize(expression);
    if (tokens.length === 0) {
      throw new Error("Empty arithmetic expression.");
    }

    let position = 0;

    const parseExpression = (): number => {
      let value = parseTerm();
      while (tokens[position] === "+" || tokens[position] === "-") {
        const operator = tokens[position++];
        const right = parseTerm();
        value = operator === "+" ? value + right : value - right;
      }
      return value;
    };

    const parseTerm = (): number => {
      let value = parseFactor();
      while (tokens[position] === "*" || tokens[position] === "/") {
        const operator = tokens[position++];
        const right = parseFactor();
        if (operator === "/") {
          if (right === 0) {
            throw new Error("Division by zero is not allowed.");
          }
          value = value / right;
        } else {
          value = value * right;
        }
      }
      return value;
    };

    const parseFactor = (): number => {
      const token = tokens[position];
      if (!token) {
        throw new Error("Unexpected end of expression.");
      }

      if (token === "+" || token === "-") {
        position++;
        const factor = parseFactor();
        return token === "-" ? -factor : factor;
      }

      if (token === "(") {
        position++;
        const value = parseExpression();
        if (tokens[position] !== ")") {
          throw new Error("Mismatched parentheses in expression.");
        }
        position++;
        return value;
      }

      const num = Number(token);
      if (Number.isNaN(num)) {
        throw new Error(`Invalid numeric token: ${token}`);
      }
      position++;
      return num;
    };

    const result = parseExpression();
    if (position < tokens.length) {
      throw new Error(`Unexpected token: ${tokens[position]}`);
    }

    if (!Number.isFinite(result)) {
      throw new Error("Arithmetic evaluation produced a non-finite result.");
    }

    return Number(result.toFixed(8));
  }

  private tokenize(expression: string): string[] {
    const matches = expression.match(/\d+(?:\.\d+)?|[+\-*/()]/g);
    return matches ?? [];
  }
}
