import { create } from "@bufbuild/protobuf";
import { CommandSchema } from "./proto/cmd_pb";
import type { Command } from "./proto/cmd_pb";
import type { Cmd, WireCommandInput } from "./cmd";

export const wire = {
    command<K extends Cmd>(input: WireCommandInput & { cmd: K }): Command {
        return create(CommandSchema, { 
            cmd: input.cmd, 
            args: input.args?.map(arg => arg?.toString() ?? '') ?? [] 
        });
    },
};
