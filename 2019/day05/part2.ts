const readline = require("readline");

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

function processIntcodeInputImpl(input: number[]): void {
    const computer = new IntcodeComputer(input);
    try {
        while (computer.execute().op !== "halt") {}
    } catch (err) {
        console.error(err);
    }
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
                    console.log(this.get(result.value));
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

    private doLessThan(op: Operation): ExecutionResult {
        this.compare(op, (param1, param2) => {
            return param1 < param2 ? 1 : 0;
        });
        return {
            op: "equals",
        };
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
        return 5; // TODO make it read from stdin
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
    getParamValue(param: Parameter): number {
        switch (param.mode) {
            case "positional":
                return this.get(param.value);
            case "immediate":
                return param.value;
        }
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
    "3,225,1,225,6,6,1100,1,238,225,104,0,1101,65,73,225,1101,37,7,225,1101,42,58,225,1102,62,44,224,101,-2728,224,224,4,224,102,8,223,223,101,6,224,224,1,223,224,223,1,69,126,224,101,-92,224,224,4,224,1002,223,8,223,101,7,224,224,1,223,224,223,1102,41,84,225,1001,22,92,224,101,-150,224,224,4,224,102,8,223,223,101,3,224,224,1,224,223,223,1101,80,65,225,1101,32,13,224,101,-45,224,224,4,224,102,8,223,223,101,1,224,224,1,224,223,223,1101,21,18,225,1102,5,51,225,2,17,14,224,1001,224,-2701,224,4,224,1002,223,8,223,101,4,224,224,1,223,224,223,101,68,95,224,101,-148,224,224,4,224,1002,223,8,223,101,1,224,224,1,223,224,223,1102,12,22,225,102,58,173,224,1001,224,-696,224,4,224,1002,223,8,223,1001,224,6,224,1,223,224,223,1002,121,62,224,1001,224,-1302,224,4,224,1002,223,8,223,101,4,224,224,1,223,224,223,4,223,99,0,0,0,677,0,0,0,0,0,0,0,0,0,0,0,1105,0,99999,1105,227,247,1105,1,99999,1005,227,99999,1005,0,256,1105,1,99999,1106,227,99999,1106,0,265,1105,1,99999,1006,0,99999,1006,227,274,1105,1,99999,1105,1,280,1105,1,99999,1,225,225,225,1101,294,0,0,105,1,0,1105,1,99999,1106,0,300,1105,1,99999,1,225,225,225,1101,314,0,0,106,0,0,1105,1,99999,1008,226,677,224,102,2,223,223,1005,224,329,1001,223,1,223,7,677,226,224,102,2,223,223,1006,224,344,1001,223,1,223,1007,226,677,224,1002,223,2,223,1006,224,359,1001,223,1,223,1007,677,677,224,102,2,223,223,1005,224,374,1001,223,1,223,108,677,677,224,102,2,223,223,1006,224,389,101,1,223,223,8,226,677,224,102,2,223,223,1005,224,404,101,1,223,223,7,226,677,224,1002,223,2,223,1005,224,419,101,1,223,223,8,677,226,224,1002,223,2,223,1005,224,434,101,1,223,223,107,677,677,224,1002,223,2,223,1006,224,449,101,1,223,223,7,677,677,224,1002,223,2,223,1006,224,464,101,1,223,223,1107,226,226,224,102,2,223,223,1006,224,479,1001,223,1,223,1007,226,226,224,102,2,223,223,1006,224,494,101,1,223,223,108,226,677,224,1002,223,2,223,1006,224,509,101,1,223,223,1108,226,677,224,102,2,223,223,1006,224,524,1001,223,1,223,1008,226,226,224,1002,223,2,223,1005,224,539,101,1,223,223,107,226,226,224,102,2,223,223,1006,224,554,101,1,223,223,8,677,677,224,102,2,223,223,1005,224,569,101,1,223,223,107,226,677,224,102,2,223,223,1005,224,584,101,1,223,223,1108,226,226,224,1002,223,2,223,1005,224,599,1001,223,1,223,1008,677,677,224,1002,223,2,223,1005,224,614,101,1,223,223,1107,226,677,224,102,2,223,223,1005,224,629,101,1,223,223,1108,677,226,224,1002,223,2,223,1005,224,644,1001,223,1,223,1107,677,226,224,1002,223,2,223,1006,224,659,1001,223,1,223,108,226,226,224,102,2,223,223,1006,224,674,101,1,223,223,4,223,99,226";

// const input = '3,12,6,12,15,1,13,14,13,4,13,99,-1,0,1,9';

// const input = '3,21,1008,21,8,20,1005,20,22,107,8,21,20,1006,20,31,1106,0,36,98,0,0,1002,21,125,20,4,20,1105,1,46,104,999,1105,1,46,1101,1000,1,20,4,20,1105,1,46,98,99';

// const input = '3,9,8,9,10,9,4,9,99,-1,8';

console.log(processIntcodeInputImpl(parseInputString(input)));
