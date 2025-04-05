import { create } from "@bufbuild/protobuf";
import { CommandSchema, ResponseSchema } from "./gen/proto/cmd_pb.ts";
import type { Command, Response } from "./gen/proto/cmd_pb.ts";
import type {Cmd} from "./cmd.ts";

export const wire = {
    command({ cmd, args }: { cmd: Cmd; args: Array<any> }): Command {
        return create(CommandSchema, { cmd, args });
    },
};
