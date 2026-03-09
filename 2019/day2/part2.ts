function processIntcodeInput(inputString: string): number {
  const originalInput = parseInputString(inputString);

  for (let noun = 0; noun <= 99; ++noun) {
    for (let verb = 0; verb <= 99; ++verb) {
      const input = [...originalInput];
      fixProgram(input, noun, verb);
      const computer = new IntcodeComputer(input);
      try {
        while (computer.execute().op !== "halt") {}
      } catch {
        continue;
      }

      if (computer.get(0) === 19690720) {
        return 100 * noun + verb;
      }
    }
  }

  return -1;
}

function parseInputString(inputString: string): number[] {
  return inputString.split(",").map((numberString) => parseInt(numberString));
}

function fixProgram(input: number[], noun: number, verb: number) {
  input[1] = noun;
  input[2] = verb;
}

class IntcodeComputer {
  private cursor: number;
  private _hasHalted: boolean;
  constructor(private program: number[]) {
    this.cursor = 0;
    this._hasHalted = false;
  }

  /**
   * @preCondition the program has not reached the halt signal
   * @postCondition the program is modified in-place
   * @returns the execution result containing:
   *          op: the operation that was just carried out
   */
  public execute(): ExecutionResult {
    if (this.hasHalted()) {
      throw new Error("Invalid state: program has reached halt signal");
    }

    const op = this.getNextValue();
    switch (op) {
      case 1:
        return this.doAdd();
      case 2:
        return this.doMultiply();
      case 99:
        return this.doHalt();
      default:
        throw new Error(`Invalid state: invalid operation - ${op}`);
    }
  }

  private doMultiply(): ExecutionResult {
    this.doBinaryOperation((a, b) => a * b);
    return {
      op: "multiply",
    };
  }

  private doAdd(): ExecutionResult {
    this.doBinaryOperation((a, b) => a + b);
    return {
      op: "add",
    };
  }

  private doHalt(): ExecutionResult {
    this._hasHalted = true;
    return {
      op: "halt",
    };
  }

  private doBinaryOperation(op: (a: number, b: number) => number) {
    const [lhsIndex, rhsIndex, resultIndex] = this.getNextOperands(3);
    const lhs = this.get(lhsIndex);
    const rhs = this.get(rhsIndex);
    this.set(resultIndex, op(lhs, rhs));
  }

  private set(resultIndex: number, value: number) {
    this.assertValidIndex(resultIndex);
    this.program[resultIndex] = value;
  }

  private assertValidIndex(index: number) {
    if (index < 0 || index >= this.program.length) {
      throw new Error(
        "Index out of bound. Program length is " + this.program.length,
      );
    }
  }

  private getNextOperands(count: number): number[] {
    return Array.from(new Array(count), () => {
      return this.getNextValue();
    });
  }

  private hasHalted(): boolean {
    return this._hasHalted;
  }

  private getNextValue(): number {
    const result = this.program[this.cursor++];
    if (result == null) {
      throw new Error("Invalid operation - program out of bound");
    }
    return result;
  }

  public get(index: number): number {
    this.assertValidIndex(index);
    return this.program[index];
  }
}

type Operation = "halt" | "add" | "multiply";

interface ExecutionResult {
  op: Operation;
}

const input =
  "1,0,0,3,1,1,2,3,1,3,4,3,1,5,0,3,2,13,1,19,1,10,19,23,1,23,9,27,1,5,27,31,2,31,13,35,1,35,5,39,1,39,5,43,2,13,43,47,2,47,10,51,1,51,6,55,2,55,9,59,1,59,5,63,1,63,13,67,2,67,6,71,1,71,5,75,1,75,5,79,1,79,9,83,1,10,83,87,1,87,10,91,1,91,9,95,1,10,95,99,1,10,99,103,2,103,10,107,1,107,9,111,2,6,111,115,1,5,115,119,2,119,13,123,1,6,123,127,2,9,127,131,1,131,5,135,1,135,13,139,1,139,10,143,1,2,143,147,1,147,10,0,99,2,0,14,0";

console.log(processIntcodeInput(input));
