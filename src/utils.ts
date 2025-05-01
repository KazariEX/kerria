export const isDev = process.env.NODE_ENV === "development";

export function capitalize(str: string) {
    return str[0].toUpperCase() + str.slice(1);
}
