function processIntcodeProgram(programString: string): number {
    const originalProgram = parseInputString(programString);
    let max = -Infinity;

    permutateAmplifierSetting([5, 6, 7, 8, 9], (settings: number[]) => {
        let output: number = 0;
        let hasOutput = true;
        const stdout = (value: number) => {
            output = value;
            hasOutput = true;
        };

        const amplifiers = settings.map((setting) => {
            const result = new IntcodeComputer([...originalProgram], stdout);
            result.startOver([setting]);
            result.execute();
            return result;
        });

        let i = 0;
        while (hasOutput) {
            const amplifier = amplifiers[i];
            i = (i + 1) % 5;

            amplifier.setInput([output]);
            hasOutput = false;
            while (!hasOutput && amplifier.execute().op !== "halt") {}
        }

        max = Math.max(max, output);
    });

    return max;
}

function permutateAmplifierSetting(
    candidates: number[],
    onPermutation: (settings: number[]) => void,
) {
    const usedIndex = new Set<number>();

    permutateAmplifierSettingRecursion(
        [],
        candidates,
        usedIndex,
        onPermutation,
    );
}

function permutateAmplifierSettingRecursion(
    current: number[],
    candidates: number[],
    usedIndex: Set<number>,
    onPermutation: (settings: number[]) => void,
): void {
    if (current.length === candidates.length) {
        onPermutation(current);
        return;
    }

    for (let i = 0; i < candidates.length; ++i) {
        if (!usedIndex.has(i)) {
            usedIndex.add(i);
            current.push(candidates[i]);
            permutateAmplifierSettingRecursion(
                current,
                candidates,
                usedIndex,
                onPermutation,
            );
            current.pop();
            usedIndex.delete(i);
        }
    }
}

function parseInputString(inputString: string): number[] {
    return inputString.split(",").map((numberString) => parseInt(numberString));
}

class IntcodeComputer {
    private cursor: number;
    private _hasHalted: boolean;

    private inputCursor: number;
    private input: number[];

    constructor(
        private program: number[],
        private stdout: (value: number) => void,
    ) {
        this.cursor = 0;
        this._hasHalted = false;

        this.inputCursor = 0;
        this.input = [];
    }

    public startOver(input: number[]): void {
        this.cursor = 0;
        this._hasHalted = false;

        this.setInput(input);
    }

    public setInput(input: number[]): void {
        this.input = input;
        this.inputCursor = 0;
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

        const op: Operation = this.getNextOperation();
        switch (op.name) {
            case "add":
                return this.doAdd(op);
            case "multiply":
                return this.doMultiply(op);
            case "halt":
                return this.doHalt();
            case "input":
                return this.doInput(op);
            case "output":
                const result = this.doOutput(op);
                if (result.op === "output") {
                    this.stdout(this.get(result.value));
                }
                return result;
            case "jump-if-false":
                this.doJumpIf(op, false);
                return {
                    op: "jump-if-false",
                };
            case "jump-if-true":
                this.doJumpIf(op, true);
                return {
                    op: "jump-if-true",
                };
            case "less-than":
                return this.doLessThan(op);
            case "equals":
                return this.doEquals(op);
            default:
                throw new Error(`Invalid state: invalid operation - ${op}`);
        }
    }

    private doEquals(op: Operation): ExecutionResult {
        this.compare(op, (param1, param2) => {
            return param1 === param2 ? 1 : 0;
        });
        return {
            op: "equals",
        };
    }

    private doLessThan(op: Operation): ExecutionResult {
        this.compare(op, (param1, param2) => {
            return param1 < param2 ? 1 : 0;
        });
        return {
            op: "equals",
        };
    }

    private compare(
        op: Operation,
        comparator: (param1: number, param2: number) => number,
    ) {
        this.processParams(op, ([param1, param2, param3]) => {
            this.set(
                param3.value,
                comparator(
                    this.getParamValue(param1),
                    this.getParamValue(param2),
                ),
            );
        });
    }

    private doJumpIf(op: Operation, match: boolean): void {
        this.processParams(op, (params) => {
            const [param1, param2] = params.map((param) =>
                this.getParamValue(param),
            );
            if ((match && param1 !== 0) || (!match && param1 === 0)) {
                this.cursor = param2;
            }
        });
    }

    private doOutput(op: Operation): ExecutionResult {
        let result: number = -1;
        this.processParams(op, ([param]) => {
            result = this.getParamValue(param);
        });

        return {
            op: "output",
            value: result,
        };
    }

    private doInput(op: Operation): ExecutionResult {
        this.processParams(op, ([param]) => {
            const value = this.getParamValue(param);
            this.set(value, this.getInput());
        });

        return {
            op: "input",
        };
    }

    private getInput(): number {
        return this.input[this.inputCursor++];
    }

    private doMultiply(operation: Operation): ExecutionResult {
        this.processParams(operation, ([lhs, rhs, result]) => {
            const lhsValue = this.getParamValue(lhs);
            const rhsValue = this.getParamValue(rhs);
            this.set(result.value, lhsValue * rhsValue);
        });

        return {
            op: "multiply",
        };
    }

    private doAdd(operation: Operation): ExecutionResult {
        this.processParams(operation, ([lhs, rhs, result]) => {
            const lhsValue = this.getParamValue(lhs);
            const rhsValue = this.getParamValue(rhs);
            this.set(result.value, lhsValue + rhsValue);
        });
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

    private getNextOperation(): Operation {
        const opCode = this.getNextValue();
        switch (opCode % 100) {
            case 1:
                return {
                    name: "add",
                    numParams: 3,
                    paramModes: this.getParamModes(opCode, 3),
                };
            case 2:
                return {
                    name: "multiply",
                    numParams: 3,
                    paramModes: this.getParamModes(opCode, 3),
                };
            case 3:
                return {
                    name: "input",
                    numParams: 1,
                    paramModes: ["immediate"],
                };
            case 4:
                return {
                    name: "output",
                    numParams: 1,
                    paramModes: ["immediate"],
                };
            case 5:
                return {
                    name: "jump-if-true",
                    numParams: 2,
                    paramModes: this.getParamModes(opCode, 2),
                };
            case 6:
                return {
                    name: "jump-if-false",
                    numParams: 2,
                    paramModes: this.getParamModes(opCode, 2),
                };
            case 7:
                return {
                    name: "less-than",
                    numParams: 3,
                    paramModes: this.getParamModes(opCode, 3),
                };
            case 8:
                return {
                    name: "equals",
                    numParams: 3,
                    paramModes: this.getParamModes(opCode, 3),
                };
            case 99:
                return {
                    name: "halt",
                    numParams: 0,
                    paramModes: [],
                };
            default:
                throw new Error(`Invalid opCode - ${opCode}`);
        }
    }

    private getParamModes(opCode: number, numParams: number): ParamMode[] {
        let modes = Math.floor(opCode / 100);

        const result: ParamMode[] = [];

        for (let i = 0; i < numParams; ++i) {
            const mode = modes % 10;
            modes = Math.floor(modes / 10);
            result.push(this.getParamMode(mode));
        }

        return result;
    }

    private getParamMode(mode: number): ParamMode {
        switch (mode) {
            case 0:
                return "positional";
            case 1:
                return "immediate";
            default:
                throw new Error(`Invalid param mode - ${mode}`);
        }
    }

    getParamValue(param: Parameter): number {
        switch (param.mode) {
            case "positional":
                return this.get(param.value);
            case "immediate":
                return param.value;
        }
    }

    private processParams(
        operation: Operation,
        op: (params: Parameter[]) => void,
    ) {
        const operands = this.getParams(operation);
        op(operands);
    }

    private doUnaryOperation(op: (a: number) => unknown) {
        throw new Error("TODO");
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

    private getParams({ numParams, paramModes }: Operation): Parameter[] {
        if (numParams !== paramModes.length) {
            throw new Error(
                `Invalid input - requesting ${numParams} params, ` +
                    `but only have ${paramModes.length} modes`,
            );
        }

        return Array.from(new Array(numParams), (_, i) => {
            const value = this.getNextValue();
            return {
                mode: paramModes[i],
                value,
            };
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

type OpName =
    | "halt"
    | "add"
    | "multiply"
    | "input"
    | "output"
    | "jump-if-false"
    | "jump-if-true"
    | "less-than"
    | "equals";
type ParamMode = "positional" | "immediate";
type Operation = {
    name: OpName;
    paramModes: ParamMode[];
    numParams: number;
};

type ExecutionResult =
    | {
          op: Exclude<OpName, "output">;
      }
    | {
          op: "output";
          value: number;
      };

interface Parameter {
    mode: ParamMode;
    value: number;
}

const input =
    "3,8,1001,8,10,8,105,1,0,0,21,34,51,76,101,126,207,288,369,450,99999,3,9,102,4,9,9,1001,9,2,9,4,9,99,3,9,1001,9,2,9,1002,9,3,9,101,3,9,9,4,9,99,3,9,102,5,9,9,1001,9,2,9,102,2,9,9,101,3,9,9,1002,9,2,9,4,9,99,3,9,101,5,9,9,102,5,9,9,1001,9,2,9,102,3,9,9,1001,9,3,9,4,9,99,3,9,101,2,9,9,1002,9,5,9,1001,9,5,9,1002,9,4,9,101,5,9,9,4,9,99,3,9,1002,9,2,9,4,9,3,9,102,2,9,9,4,9,3,9,1001,9,1,9,4,9,3,9,102,2,9,9,4,9,3,9,1001,9,1,9,4,9,3,9,101,1,9,9,4,9,3,9,1001,9,2,9,4,9,3,9,1002,9,2,9,4,9,3,9,1001,9,1,9,4,9,3,9,1001,9,1,9,4,9,99,3,9,102,2,9,9,4,9,3,9,101,2,9,9,4,9,3,9,102,2,9,9,4,9,3,9,1002,9,2,9,4,9,3,9,1001,9,2,9,4,9,3,9,101,1,9,9,4,9,3,9,1001,9,2,9,4,9,3,9,102,2,9,9,4,9,3,9,101,1,9,9,4,9,3,9,102,2,9,9,4,9,99,3,9,101,2,9,9,4,9,3,9,101,2,9,9,4,9,3,9,101,1,9,9,4,9,3,9,1001,9,2,9,4,9,3,9,101,2,9,9,4,9,3,9,101,2,9,9,4,9,3,9,102,2,9,9,4,9,3,9,102,2,9,9,4,9,3,9,1001,9,2,9,4,9,3,9,1001,9,1,9,4,9,99,3,9,1001,9,2,9,4,9,3,9,101,1,9,9,4,9,3,9,102,2,9,9,4,9,3,9,1001,9,1,9,4,9,3,9,101,1,9,9,4,9,3,9,101,2,9,9,4,9,3,9,1001,9,1,9,4,9,3,9,101,2,9,9,4,9,3,9,102,2,9,9,4,9,3,9,102,2,9,9,4,9,99,3,9,1001,9,2,9,4,9,3,9,102,2,9,9,4,9,3,9,1002,9,2,9,4,9,3,9,102,2,9,9,4,9,3,9,102,2,9,9,4,9,3,9,1001,9,1,9,4,9,3,9,101,2,9,9,4,9,3,9,102,2,9,9,4,9,3,9,102,2,9,9,4,9,3,9,102,2,9,9,4,9,99";

console.log(processIntcodeProgram(input));
