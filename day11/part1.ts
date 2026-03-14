class IntcodeComputer {
    private cursor: number; // 2
    private _hasHalted: boolean; // false

    private relativeBase: number; // 3

    constructor(
        private program: number[],
        private stdin: () => number,
    ) {
        this.cursor = 0;
        this._hasHalted = false;

        this.relativeBase = 0;
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
        return this.stdin();
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

    public hasHalted(): boolean {
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

//====================================== Painting Robot ====================================

class PaintingRobot {
    constructor() {}

    /**
     * Get the number of distinct panels that has been painted.
     */
    getDistinctPaintedCount(): number {
        throw new Error("Method not implemented.");
    }

    /**
     * @param value direction the robot should turn: 0 means it should turn left 90 degrees,
     * and 1 means it should turn right 90 degrees.
     */
    move(value: number) {
        throw new Error("Method not implemented.");
    }

    /**
     * Paint the panel underneath the robot
     */
    paint(value: number) {
        throw new Error("Method not implemented.");
    }

    getColor(): number {
        throw new Error("Method not implemented.");
    }
}

//====================================== Painting Robot End ================================

const input =
    "3,8,1005,8,311,1106,0,11,0,0,0,104,1,104,0,3,8,102,-1,8,10,101,1,10,10,4,10,1008,8,1,10,4,10,1001,8,0,29,1006,0,98,2,1005,8,10,1,1107,11,10,3,8,102,-1,8,10,1001,10,1,10,4,10,1008,8,0,10,4,10,101,0,8,62,1006,0,27,2,1002,12,10,3,8,1002,8,-1,10,1001,10,1,10,4,10,108,0,8,10,4,10,1002,8,1,90,1,1006,1,10,2,1,20,10,3,8,102,-1,8,10,1001,10,1,10,4,10,1008,8,1,10,4,10,102,1,8,121,1,1003,5,10,1,1003,12,10,3,8,102,-1,8,10,101,1,10,10,4,10,1008,8,1,10,4,10,1002,8,1,151,1006,0,17,3,8,102,-1,8,10,1001,10,1,10,4,10,108,0,8,10,4,10,1002,8,1,175,3,8,102,-1,8,10,1001,10,1,10,4,10,108,1,8,10,4,10,101,0,8,197,2,6,14,10,1006,0,92,1006,0,4,3,8,1002,8,-1,10,101,1,10,10,4,10,108,0,8,10,4,10,1001,8,0,229,1006,0,21,2,102,17,10,3,8,1002,8,-1,10,101,1,10,10,4,10,1008,8,1,10,4,10,1001,8,0,259,3,8,102,-1,8,10,1001,10,1,10,4,10,108,0,8,10,4,10,102,1,8,280,1006,0,58,1006,0,21,2,6,11,10,101,1,9,9,1007,9,948,10,1005,10,15,99,109,633,104,0,104,1,21101,937150919572,0,1,21102,328,1,0,1105,1,432,21101,0,387394675496,1,21102,1,339,0,1106,0,432,3,10,104,0,104,1,3,10,104,0,104,0,3,10,104,0,104,1,3,10,104,0,104,1,3,10,104,0,104,0,3,10,104,0,104,1,21102,46325083283,1,1,21102,1,386,0,1106,0,432,21101,0,179519401051,1,21102,397,1,0,1106,0,432,3,10,104,0,104,0,3,10,104,0,104,0,21102,1,868410348308,1,21102,1,420,0,1105,1,432,21102,718086501140,1,1,21102,1,431,0,1105,1,432,99,109,2,22101,0,-1,1,21101,40,0,2,21101,0,463,3,21101,453,0,0,1106,0,496,109,-2,2105,1,0,0,1,0,0,1,109,2,3,10,204,-1,1001,458,459,474,4,0,1001,458,1,458,108,4,458,10,1006,10,490,1101,0,0,458,109,-2,2105,1,0,0,109,4,2102,1,-1,495,1207,-3,0,10,1006,10,513,21102,0,1,-3,22102,1,-3,1,22102,1,-2,2,21102,1,1,3,21102,1,532,0,1105,1,537,109,-4,2105,1,0,109,5,1207,-3,1,10,1006,10,560,2207,-4,-2,10,1006,10,560,22101,0,-4,-4,1105,1,628,22102,1,-4,1,21201,-3,-1,2,21202,-2,2,3,21102,1,579,0,1105,1,537,22101,0,1,-4,21102,1,1,-1,2207,-4,-2,10,1006,10,598,21102,1,0,-1,22202,-2,-1,-2,2107,0,-3,10,1006,10,620,22102,1,-1,1,21102,1,620,0,105,1,495,21202,-2,-1,-2,22201,-4,-2,-4,109,-5,2106,0,0";

processIntcodeProgram(input);

function processIntcodeProgram(programString: string): number {
    const program = parseInputString(programString);

    const robot = new PaintingRobot();

    const computer = new IntcodeComputer(program, () => robot.getColor());

    while (!computer.hasHalted()) {
        const inputResult = computer.execute();
        assertResultType(inputResult, "input");

        const paintOutput = computer.execute();
        if (paintOutput.op !== "output") {
            throw new Error(
                `Unexpected result. Expecting output; received ${paintOutput.op}`,
            );
        }
        robot.paint(paintOutput.value);

        const directionOutput = computer.execute();
        if (directionOutput.op !== "output") {
            throw new Error(
                `Unexpected result. Expecting output; received ${paintOutput.op}`,
            );
        }
        robot.move(directionOutput.value);
    }

    return robot.getDistinctPaintedCount();
}

function assertResultType(inputResult: ExecutionResult, expected: OpName) {
    if (inputResult.op !== expected) {
        throw new Error(
            `Unexpected operation result. Expecting "${expected}"; received "${inputResult.op}"`,
        );
    }
}

function parseInputString(inputString: string): number[] {
    return inputString.split(",").map((numberString) => parseInt(numberString));
}
