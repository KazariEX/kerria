import { resolve } from "pathe";
import { writeJson } from "../utils";
import { useCurrentContext } from "./kerria";
import type { MaybePromise } from "../types";

export interface SourceInfo extends Omit<UseSourceOptions, "folders"> {
    kind: number;
    folders: string[];
    patterns: string[];
    filter: (path: string) => boolean;
    output: (path: string, data: any) => Promise<void>;
}

export interface UseSourceOptions<T = any> {
    base: string;
    dist?: string;
    folders?: string[];
    ext: string;
    deep?: boolean;
    skip?: number;
    parse: (path: string, info: SourceInfo) => MaybePromise<T | null | void>;
    cache?: (cache: T) => void;
    unlink?: (cache: T) => void;
}

export function useSource<T extends object>(kind: number, options: UseSourceOptions<T>) {
    const ctx = useCurrentContext();
    const {
        deep = true,
        skip = 0,
    } = options;

    const base = resolve(options.base);
    const dist = options.dist ? resolve(options.dist) : void 0;
    const folders = options.folders?.map((folder) => resolve(base, folder)) ?? [base];
    const patterns = folders.map((path) => resolve(path, (deep ? "**/*" : "*") + options.ext));

    const info: SourceInfo = {
        ...options,
        kind,
        base,
        dist,
        folders,
        patterns,
        deep,
        skip,
        filter(path) {
            const depth = path.split("/").length - folders[0].split("/").length;
            return skip < depth;
        },
        output(path, data) {
            const outPath = path.replace(base, dist!).replace(info.ext, ".json");
            return writeJson(outPath, data);
        },
    };
    ctx.sourceInfos.push(info);

    return info;
}
