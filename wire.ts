import { create } from "@bufbuild/protobuf";
import { CommandSchema, ResponseSchema } from "./gen/proto/cmd_pb.ts";
import type { Command, Response } from "./gen/proto/cmd_pb.ts";

export const wire = {
    command({ cmd, args }: { cmd: string; args: Array<any> }): Command {
        return create(CommandSchema, { cmd, args });
    },
};
