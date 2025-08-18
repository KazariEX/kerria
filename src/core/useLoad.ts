import { resolve } from "pathe";
import { readJsonSync, writeJsonSync } from "../utils";
import { useCurrentContext } from "./kerria";

export interface LoadInfo extends Omit<UseLoadOptions, "defaultValue" | "output"> {
    name: string;
    value: any;
    output: () => void;
}

export interface UseLoadOptions {
    src?: string;
    out: string;
    defaultValue?: unknown;
    update?: (newVal: any, oldVal: any) => any;
    output?: (val: any) => any;
}

export function useLoad(name: string, options: UseLoadOptions) {
    const ctx = useCurrentContext();
    const {
        defaultValue = {},
        update,
        output,
    } = options;

    const src = options.src ? resolve(options.src) : void 0;
    const out = resolve(options.out);

    const info: LoadInfo = {
        name,
        src,
        out,
        value: src ? readJsonSync(src) : defaultValue,
        update,
        output() {
            const data = output?.(info.value) ?? info.value;
            writeJsonSync(out, data);
        },
    };
    ctx.loadInfos.push(info);
    update?.(info.value, void 0);

    return info;
}
