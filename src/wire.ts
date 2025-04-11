import { create } from "@bufbuild/protobuf";
import { CommandSchema } from "./proto/cmd_pb";
import type { Command } from "./proto/cmd_pb";
import type {Cmd, WireCommandInput} from "./cmd";

export const wire = {
    command({ cmd, args }: WireCommandInput): Command {
        return create(CommandSchema, { cmd, args });
    },
};
