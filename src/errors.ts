export class PacificaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PacificaError';
    }
}

export class AuthenticationError extends PacificaError {
    constructor(message: string = 'Authentication failed') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

export class NetworkError extends PacificaError {
    constructor(message: string = 'Network error occurred') {
        super(message);
        this.name = 'NetworkError';
    }
}

export class ValidationError extends PacificaError {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class OrderError extends PacificaError {
    constructor(message: string) {
        super(message);
        this.name = 'OrderError';
    }
}
