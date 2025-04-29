import { create } from "@bufbuild/protobuf";
import { CommandSchema } from "./wire/cmd_pb";
import type { Command } from "./wire/cmd_pb";
import type { Cmd, WireCommandInput } from "./cmd";

export const wire = {
    command<K extends Cmd>(input: WireCommandInput & { cmd: K }): Command {
        return create(CommandSchema, { 
            cmd: input.cmd, 
            args: input.args?.map(arg => arg?.toString() ?? '') ?? [] 
        });
    },
};
