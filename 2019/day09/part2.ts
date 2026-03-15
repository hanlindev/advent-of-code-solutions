function processIntcodeProgram(programString: string): number {
    const stdout = (value: number) => {
        console.log(value);
    };

    // 109,1,204,-1,1001,100,1,100,1008,100,16,101,1006,101,0,99..... [100]:1,[101]:0
    //        ^

    const program = appendEmptyMemory(parseInputString(programString));

    const computer = new IntcodeComputer(program, stdout);
    computer.startOver([2]);

    while (computer.execute().op !== "halt") {}

    return 0;
}

function appendEmptyMemory(originalProgram: number[]): number[] {
    return originalProgram.concat(
        new Array(originalProgram.length * 10000).fill(0),
    );
}

function parseInputString(inputString: string): number[] {
    return inputString.split(",").map((numberString) => parseInt(numberString));
}

class IntcodeComputer {
    private cursor: number; // 2
    private _hasHalted: boolean; // false

    private inputCursor: number; // 0
    private input: number[]; // []

    private relativeBase: number; // 3

    constructor(
        private program: number[],
        private stdout: (value: number) => void,
    ) {
        this.cursor = 0;
        this._hasHalted = false;

        this.inputCursor = 0;
        this.input = [];

        this.relativeBase = 0;
    }

    public startOver(input: number[]): void {
        this.cursor = 0;
        this._hasHalted = false;

        this.setInput(input);
        this.relativeBase = 0;
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
        /*
        op: output
        numParam: 1
        paramMode: relative
        */
        switch (op.name) {
            case "halt":
                return this.doHalt();
            case "add":
                return this.doAdd(op);
            case "multiply":
                return this.doMultiply(op);
            case "input":
                return this.doInput(op);
            case "output":
                const result = this.doOutput(op);
                if (result.op === "output") {
                    this.stdout(result.value);
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
            case "adjust-relative-base":
                return this.doAdjustRelativeBase(op);
            default:
                throw new Error(`Invalid state: invalid operation - ${op}`);
        }
    }

    private doAdjustRelativeBase(op: Operation): ExecutionResult {
        /*
        op: adjust-relative-base
        numParam: 1
        paramMode: immediate
        */
        this.processParams(op, ([param]) => {
            /*
            paramMode: immediate
            value: 1
            */
            const delta = this.getParamValue(param);
            this.relativeBase += delta;
        });

        return {
            op: "adjust-relative-base",
        };
    }

    private doEquals(op: Operation): ExecutionResult {
        /*
        op: equals
        numParam: 3
        paramMode: positional, immediate, positional
        */
        this.compare(op, (param1, param2) => {
            /**
             * param1: 1
             * param2: 16
             */
            return param1 === param2 ? 1 : 0; // returns 0
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
            /*
            param1: 100, positional
            param2: 16, immediate
            param3: 101, positional
            */
            this.set(
                param3, // [101] = 0
                comparator(
                    this.getParamValue(param1),
                    this.getParamValue(param2),
                ),
            );
        });
    }

    private doJumpIf(op: Operation, match: boolean): void {
        /*
        op: jump-if-false
        numParam: 2
        paramMode: positional, immediate

        match: false
        */
        this.processParams(op, (params) => {
            /**
             * param1: 101, positional
             * param2: 0, immediate
             */
            const [param1, param2] = params.map((param) =>
                this.getParamValue(param),
            );
            /**
             * values
             * param1:
             * param2:
             */
            if ((match && param1 !== 0) || (!match && param1 === 0)) {
                this.cursor = param2;
            }
        });
    }

    private doOutput(op: Operation): ExecutionResult {
        /*
        op: output
        numParmas: 1
        paramModes: ['relative']
        */
        let result: number = -1;
        this.processParams(op, ([param]) => {
            /*
            paramMode: 'relative',
            value: -1
            */
            result = this.getParamValue(param);
        });

        return {
            op: "output",
            value: result,
        };
    }

    private doInput(op: Operation): ExecutionResult {
        this.processParams(op, ([param]) => {
            this.set(param, this.getInput());
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
            this.set(result, lhsValue * rhsValue);
        });

        return {
            op: "multiply",
        };
    }

    private doAdd(operation: Operation): ExecutionResult {
        /*
        op: add
        numParam: 3
        paramMode: positional, immediate, positional
        */
        this.processParams(operation, ([lhs, rhs, result]) => {
            /*
            lhs: 100, positional
            rhs: 1, immediate
            result: 100, positional
            */
            const lhsValue = this.getParamValue(lhs); // 0
            const rhsValue = this.getParamValue(rhs); // 1
            this.set(result, lhsValue + rhsValue); // [100] = 1
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
                    paramModes: this.getParamModes(opCode, 1),
                };
            case 4:
                return {
                    name: "output",
                    numParams: 1,
                    paramModes: this.getParamModes(opCode, 1),
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
            case 9:
                return {
                    name: "adjust-relative-base",
                    numParams: 1,
                    paramModes: this.getParamModes(opCode, 1),
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
            case 2:
                return "relative";
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
            case "relative":
                return this.get(this.relativeBase + param.value);
        }
    }

    private processParams(
        operation: Operation,
        op: (params: Parameter[]) => void,
    ) {
        const operands = this.getParams(operation);
        op(operands);
    }

    private set(param: Parameter, value: number) {
        const resultIndex = this.getIndex(param);
        this.assertValidIndex(resultIndex);
        this.program[resultIndex] = value;
    }

    getIndex(param: Parameter) {
        switch (param.mode) {
            case "positional":
                return param.value;
            case "relative":
                return this.relativeBase + param.value;
            default:
                throw new Error(
                    `Parameter mode cannot be used as index - ${param.mode}`,
                );
        }
    }

    private assertValidIndex(index: number) {
        if (index < 0 || index >= this.program.length) {
            throw new Error(
                `Index out of bound. Received ${index}  Program length is ${this.program.length}`,
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
    | "add"
    | "multiply"
    | "input"
    | "output"
    | "jump-if-true"
    | "jump-if-false"
    | "less-than"
    | "equals"
    | "adjust-relative-base"
    | "halt";

type ParamMode = "positional" | "immediate" | "relative";
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

// const input = '3,225,1,225,6,6,1100,1,238,225,104,0,1101,65,73,225,1101,37,7,225,1101,42,58,225,1102,62,44,224,101,-2728,224,224,4,224,102,8,223,223,101,6,224,224,1,223,224,223,1,69,126,224,101,-92,224,224,4,224,1002,223,8,223,101,7,224,224,1,223,224,223,1102,41,84,225,1001,22,92,224,101,-150,224,224,4,224,102,8,223,223,101,3,224,224,1,224,223,223,1101,80,65,225,1101,32,13,224,101,-45,224,224,4,224,102,8,223,223,101,1,224,224,1,224,223,223,1101,21,18,225,1102,5,51,225,2,17,14,224,1001,224,-2701,224,4,224,1002,223,8,223,101,4,224,224,1,223,224,223,101,68,95,224,101,-148,224,224,4,224,1002,223,8,223,101,1,224,224,1,223,224,223,1102,12,22,225,102,58,173,224,1001,224,-696,224,4,224,1002,223,8,223,1001,224,6,224,1,223,224,223,1002,121,62,224,1001,224,-1302,224,4,224,1002,223,8,223,101,4,224,224,1,223,224,223,4,223,99,0,0,0,677,0,0,0,0,0,0,0,0,0,0,0,1105,0,99999,1105,227,247,1105,1,99999,1005,227,99999,1005,0,256,1105,1,99999,1106,227,99999,1106,0,265,1105,1,99999,1006,0,99999,1006,227,274,1105,1,99999,1105,1,280,1105,1,99999,1,225,225,225,1101,294,0,0,105,1,0,1105,1,99999,1106,0,300,1105,1,99999,1,225,225,225,1101,314,0,0,106,0,0,1105,1,99999,1008,226,677,224,102,2,223,223,1005,224,329,1001,223,1,223,7,677,226,224,102,2,223,223,1006,224,344,1001,223,1,223,1007,226,677,224,1002,223,2,223,1006,224,359,1001,223,1,223,1007,677,677,224,102,2,223,223,1005,224,374,1001,223,1,223,108,677,677,224,102,2,223,223,1006,224,389,101,1,223,223,8,226,677,224,102,2,223,223,1005,224,404,101,1,223,223,7,226,677,224,1002,223,2,223,1005,224,419,101,1,223,223,8,677,226,224,1002,223,2,223,1005,224,434,101,1,223,223,107,677,677,224,1002,223,2,223,1006,224,449,101,1,223,223,7,677,677,224,1002,223,2,223,1006,224,464,101,1,223,223,1107,226,226,224,102,2,223,223,1006,224,479,1001,223,1,223,1007,226,226,224,102,2,223,223,1006,224,494,101,1,223,223,108,226,677,224,1002,223,2,223,1006,224,509,101,1,223,223,1108,226,677,224,102,2,223,223,1006,224,524,1001,223,1,223,1008,226,226,224,1002,223,2,223,1005,224,539,101,1,223,223,107,226,226,224,102,2,223,223,1006,224,554,101,1,223,223,8,677,677,224,102,2,223,223,1005,224,569,101,1,223,223,107,226,677,224,102,2,223,223,1005,224,584,101,1,223,223,1108,226,226,224,1002,223,2,223,1005,224,599,1001,223,1,223,1008,677,677,224,1002,223,2,223,1005,224,614,101,1,223,223,1107,226,677,224,102,2,223,223,1005,224,629,101,1,223,223,1108,677,226,224,1002,223,2,223,1005,224,644,1001,223,1,223,1107,677,226,224,1002,223,2,223,1006,224,659,1001,223,1,223,108,226,226,224,102,2,223,223,1006,224,674,101,1,223,223,4,223,99,226'; // day 5

const input =
    "1102,34463338,34463338,63,1007,63,34463338,63,1005,63,53,1102,3,1,1000,109,988,209,12,9,1000,209,6,209,3,203,0,1008,1000,1,63,1005,63,65,1008,1000,2,63,1005,63,904,1008,1000,0,63,1005,63,58,4,25,104,0,99,4,0,104,0,99,4,17,104,0,99,0,0,1101,0,31,1019,1101,25,0,1008,1102,35,1,1009,1102,422,1,1029,1102,1,21,1005,1102,1,734,1027,1102,29,1,1000,1101,32,0,1018,1102,28,1,1016,1101,0,38,1015,1101,0,378,1023,1101,30,0,1017,1102,1,381,1022,1101,0,37,1006,1102,1,1,1021,1101,0,24,1011,1102,1,23,1002,1101,0,0,1020,1101,0,20,1007,1101,427,0,1028,1101,26,0,1014,1101,27,0,1010,1101,0,39,1001,1101,34,0,1012,1102,1,36,1013,1101,0,33,1003,1101,804,0,1025,1101,737,0,1026,1102,1,809,1024,1102,1,22,1004,109,9,1201,-7,0,63,1008,63,20,63,1005,63,205,1001,64,1,64,1106,0,207,4,187,1002,64,2,64,109,2,21102,40,1,1,1008,1012,40,63,1005,63,233,4,213,1001,64,1,64,1106,0,233,1002,64,2,64,109,4,1208,-7,25,63,1005,63,255,4,239,1001,64,1,64,1106,0,255,1002,64,2,64,109,-24,1207,10,38,63,1005,63,271,1105,1,277,4,261,1001,64,1,64,1002,64,2,64,109,25,21107,41,40,-3,1005,1013,293,1105,1,299,4,283,1001,64,1,64,1002,64,2,64,109,5,1205,-1,311,1106,0,317,4,305,1001,64,1,64,1002,64,2,64,109,-23,1202,6,1,63,1008,63,22,63,1005,63,339,4,323,1105,1,343,1001,64,1,64,1002,64,2,64,109,1,2101,0,2,63,1008,63,37,63,1005,63,367,1001,64,1,64,1106,0,369,4,349,1002,64,2,64,109,29,2105,1,-5,1106,0,387,4,375,1001,64,1,64,1002,64,2,64,109,-26,2101,0,0,63,1008,63,23,63,1005,63,409,4,393,1106,0,413,1001,64,1,64,1002,64,2,64,109,26,2106,0,0,4,419,1106,0,431,1001,64,1,64,1002,64,2,64,109,-17,21108,42,42,6,1005,1017,453,4,437,1001,64,1,64,1106,0,453,1002,64,2,64,109,7,21101,43,0,-8,1008,1010,44,63,1005,63,477,1001,64,1,64,1105,1,479,4,459,1002,64,2,64,109,-7,1206,10,495,1001,64,1,64,1106,0,497,4,485,1002,64,2,64,109,-5,2108,36,0,63,1005,63,513,1106,0,519,4,503,1001,64,1,64,1002,64,2,64,109,3,2102,1,-5,63,1008,63,22,63,1005,63,541,4,525,1105,1,545,1001,64,1,64,1002,64,2,64,109,3,1207,-6,38,63,1005,63,567,4,551,1001,64,1,64,1105,1,567,1002,64,2,64,109,-15,2107,20,8,63,1005,63,585,4,573,1106,0,589,1001,64,1,64,1002,64,2,64,109,-1,1208,5,36,63,1005,63,609,1001,64,1,64,1106,0,611,4,595,1002,64,2,64,109,30,21101,44,0,-7,1008,1019,44,63,1005,63,633,4,617,1106,0,637,1001,64,1,64,1002,64,2,64,109,-25,1201,0,0,63,1008,63,39,63,1005,63,659,4,643,1105,1,663,1001,64,1,64,1002,64,2,64,109,27,1206,-8,677,4,669,1106,0,681,1001,64,1,64,1002,64,2,64,109,-28,2108,29,0,63,1005,63,703,4,687,1001,64,1,64,1106,0,703,1002,64,2,64,109,5,21107,45,46,7,1005,1012,725,4,709,1001,64,1,64,1106,0,725,1002,64,2,64,109,30,2106,0,-8,1105,1,743,4,731,1001,64,1,64,1002,64,2,64,109,-22,21102,46,1,4,1008,1017,44,63,1005,63,767,1001,64,1,64,1105,1,769,4,749,1002,64,2,64,109,-15,1202,10,1,63,1008,63,23,63,1005,63,793,1001,64,1,64,1106,0,795,4,775,1002,64,2,64,109,19,2105,1,7,4,801,1105,1,813,1001,64,1,64,1002,64,2,64,109,6,1205,-2,827,4,819,1106,0,831,1001,64,1,64,1002,64,2,64,109,-20,2107,22,2,63,1005,63,851,1001,64,1,64,1106,0,853,4,837,1002,64,2,64,109,20,21108,47,44,-8,1005,1015,869,1105,1,875,4,859,1001,64,1,64,1002,64,2,64,109,-22,2102,1,4,63,1008,63,23,63,1005,63,899,1001,64,1,64,1106,0,901,4,881,4,64,99,21101,0,27,1,21102,915,1,0,1106,0,922,21201,1,28703,1,204,1,99,109,3,1207,-2,3,63,1005,63,964,21201,-2,-1,1,21101,0,942,0,1106,0,922,22101,0,1,-1,21201,-2,-3,1,21101,957,0,0,1105,1,922,22201,1,-1,-2,1105,1,968,21201,-2,0,-2,109,-3,2105,1,0";

// const input = '109,1,204,-1,1001,100,1,100,1008,100,16,101,1006,101,0,99';

// const input = '1102,34915192,34915192,7,4,7,99,0';

processIntcodeProgram(input);
