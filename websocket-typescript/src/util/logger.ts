export class Logger {
    constructor(private prefix: string) {}

    public async debug(message: string, data?: any): Promise<void> {
        console.debug(this._formatMessage(message));
    }

    public async info(message: string, data?: any): Promise<void> {
        console.log(this._formatMessage(message));
    }

    public async warn(message: string, data?: any): Promise<void> {
        console.warn(this._formatMessage(message));
    }

    public async error(message: string, data?: any): Promise<void> {
        console.error(this._formatMessage(message));
    }

    private _formatMessage(message: string, data?: any) {
        return `${this.prefix}: ${message} ${data ?? ''}`;
    }
}
