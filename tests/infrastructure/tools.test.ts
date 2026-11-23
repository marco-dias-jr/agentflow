import { describe, expect, it } from "vitest";
import { CalculatorTool } from "../../apps/api/src/infrastructure/tools/CalculatorTool";
import { KnowledgeSearchTool } from "../../apps/api/src/infrastructure/tools/KnowledgeSearchTool";
import { ToolRegistryExecutor } from "../../apps/api/src/infrastructure/tools/ToolRegistryExecutor";

describe("Tools and ToolRegistryExecutor", () => {
  it("evaluates arithmetic expressions safely without eval", async () => {
    const calc = new CalculatorTool();
    const output = await calc.execute({ expression: "(120 * 0.15) + 45" });

    expect(output.result).toBe(63);
    await expect(calc.execute({ expression: "10 / 0" })).rejects.toThrow(
      "Division by zero is not allowed."
    );
  });

  it("searches knowledge base and returns matching runbooks", async () => {
    const search = new KnowledgeSearchTool();
    const output = await search.execute({ query: "webhook retry backoff", limit: 2 });

    expect(output.matches.length).toBeGreaterThan(0);
    expect(output.matches[0].id).toBe("kb-003");
  });

  it("blocks tools not enabled for the agent", async () => {
    const executor = new ToolRegistryExecutor();
    const definitions = executor.listDefinitions(["calculator"]);

    expect(definitions.map((d) => d.name)).toEqual(["calculator"]);

    const disabledResult = await executor.execute(
      "knowledge_search",
      { query: "rate limit" },
      ["calculator"]
    );
    expect(disabledResult.isError).toBe(true);
  });
});
