export function isStringArray(value: any): value is string[] {
    // First, check if the value is an array
    if (!Array.isArray(value)) {
        return false;
    }

    // Then, check if every element in the array is a string
    return value.every((item) => typeof item === 'string');
}
