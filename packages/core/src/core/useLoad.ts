import fs from "fs-extra";
import { resolve } from "pathe";
import { useCurrentContext } from "./processor";

export interface LoadInfo extends Omit<UseLoadOptions, "defaultValue" | "beforeOutput"> {
    name: string;
    value: any;
    output: () => void;
}

export interface UseLoadOptions {
    src?: string;
    out: string;
    defaultValue?: unknown;
    onUpdate: (newVal: any, oldVal: any) => any;
    beforeOutput?: (val: any) => any;
}

export function useLoad(name: string, options: UseLoadOptions) {
    const ctx = useCurrentContext();

    const src = options.src ? resolve(options.src) : void 0;
    const out = resolve(options.out);
    const {
        defaultValue = {},
        onUpdate,
        beforeOutput
    } = options;

    const info: LoadInfo = {
        name,
        src,
        out,
        value: src ? fs.readJsonSync(src) : defaultValue,
        onUpdate,
        output() {
            const data = beforeOutput?.(info.value) ?? info.value;
            fs.outputJsonSync(out, data);
        }
    };
    ctx.loadInfos.push(info);
    onUpdate(info.value, void 0);

    return info;
}