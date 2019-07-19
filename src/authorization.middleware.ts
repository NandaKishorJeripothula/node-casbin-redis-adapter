import { Enforcer } from 'casbin';

export class BasicAuthorizer {
    private req: any;
    private enforcer: any;

    constructor(req, enforcer) {
        this.req = req;
        this.enforcer = enforcer;
    }

    getUserRole() {
        const { user } = this.req.headers;
        return user;
    }

    checkPermission() {
        const { req, enforcer } = this;
        const { originalUrl: path, method } = req;
        const userRole = this.getUserRole();
        console.log({ userRole, path, method })
        return enforcer.enforce(userRole, path, method);
    }
}

// the authorizer middleware
export function authz(enforcer: Enforcer) {
    return async (req, res, next) => {

        if (!req.headers.user) {// user sample
            req.headers.user = 'notadmin';
        }

        if (!(enforcer instanceof Enforcer)) {
            res.status(500).json({ 500: 'Invalid enforcer' });
            return;
        }

        const authorizer = new BasicAuthorizer(req, enforcer);
        if (!authorizer.checkPermission()) {
            res.status(403).json({ 403: 'Forbidden' });
            return;
        }

        next();
    }
};
