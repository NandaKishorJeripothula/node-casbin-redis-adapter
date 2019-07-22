import { Helper } from 'casbin';
import * as redis from 'redis';
import { promisify } from 'util';

interface IConnectionOptions {
    host: string;
    port: number;
}
class Line {
    p_type: string;
    v0: string;
    v1: string;
    v2: string;
    v3: string;
    v4: string;
    v5: string;
}
export class NodeRedisAdapter {
    private redisInstance = null;
    private policies = null;
    private deliveredOptions = {
        retry_strategy(options) {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                return new Error('The server refused the connection');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
                return undefined;
            }
            // reconnect after
            return Math.min(options.attempt * 100, 300);
        },
    };

    /**
     * Helper Methods
     */

    savePolicyLine(ptype, rule) {
        const line = new Line();
        line.p_type = ptype;
        if (rule.length > 0) {
            line.v0 = rule[0];
        }

        if (rule.length > 1) {
            line.v1 = rule[1];
        }

        if (rule.length > 2) {
            line.v2 = rule[2];
        }

        if (rule.length > 3) {
            line.v3 = rule[3];
        }

        if (rule.length > 4) {
            line.v4 = rule[4];
        }

        if (rule.length > 5) {
            line.v5 = rule[5];
        }
        return line;
    }
    loadPolicyLine(line, model) {
        console.log("load Policies line called");
        let lineText = line.p_type;
        if (line.v0) {
            lineText += ", " + line.v0;
        }
        if (line.v1) {
            lineText += ", " + line.v1;
        }
        if (line.v2) {
            lineText += ", " + line.v2;
        }
        if (line.v3) {
            lineText += ", " + line.v3;
        }
        if (line.v4) {
            lineText += ", " + line.v4;
        }
        if (line.v5) {
            lineText += ", " + line.v5;
        }
        Helper.loadPolicyLine(lineText, model);
    }

    storePolicies(policies) {
        return new Promise((resolve, reject) => {
            console.log({ r: this.redisInstance });
            this.redisInstance.del('policies');
            this.redisInstance.set('policies', JSON.stringify(policies), (err, reply) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(reply);
                }
            });
        });
    }

    reducePolicies(policies, ptype, rule) {
        let i = rule.length;
        let policyIndex = policies.fieldIndex((policy) => {
            let flag = false;
            flag = policy.p_type === ptype ? true : false;
            flag = i > 5 && policy.v5 === rule[5] ? true : false;
            flag = i > 4 && policy.v4 === rule[4] ? true : false;
            flag = i > 3 && policy.v3 === rule[3] ? true : false;
            flag = i > 2 && policy.v2 === rule[2] ? true : false;
            flag = i > 1 && policy.v0 === rule[1] ? true : false;
            return flag;
        });
        if (policyIndex !== -1) {
            return policies.splice(policyIndex, 1);
        }
        return [];
    }

    constructor(options: IConnectionOptions) {
        this.redisInstance = redis.createClient(
            {
                ...options,
                ...this.deliveredOptions,
            },
        );
    }

    static async newAdapter(options: IConnectionOptions) {
        const adapter = new NodeRedisAdapter(options);
        await new Promise(resolve => adapter.redisInstance.on('connect', resolve));
        return adapter;
    }

    /**
     * Adapter Methods
     */

    loadPolicy(model) {
        this.redisInstance.get("policies", (err, policies) => {
            var AdapterRef = this;
            console.log("Loading Policies...\n", policies);
            if (!policies) {
                let tempPolicies = [];
                tempPolicies.push(
                    {
                        'p_type': 'p',
                        'v0': 'admin',
                        'v1': '/*',
                        'v2': 'GET',
                    }
                );
                tempPolicies.push(
                    {
                        'p_type': 'p',
                        'v0': 'notadmin',
                        'v1': '/',
                        'v2': 'POST'
                    }
                );
                this.redisInstance.SET('policies', JSON.stringify(tempPolicies), (err, reply) => {
                    if (!err) {
                        return console.log("Writtern temp policy");
                    }
                    return console.error(err);
                });
                return new Error("No Policies Found");
            }
            if (!err) {
                policies = JSON.parse(policies);
                this.policies = policies;//For add and remove policies methods
                console.log(policies);
                policies.forEach(function (policy, index) {
                    AdapterRef.loadPolicyLine(policy, model);
                });
                console.log("Policies are loaded");
            } else {
                return err;
            }
        });
    }

    async savePolicy(model) {
        const policyRuleAST = model.model.get("p");
        const groupingPolicyAST = model.model.get("g");
        let policies = [];
        for (const [ptype, ast] of policyRuleAST) {
            for (const rule of ast.policy) {
                const line = this.savePolicyLine(ptype, rule);
                policies.push(line);
            }
        }

        for (const [ptype, ast] of groupingPolicyAST) {
            for (const rule of ast.policy) {
                const line = this.savePolicyLine(ptype, rule);
                policies.push(line);
            }
        }
        this.storePolicies(policies);
    }
    async addPolicy(sec, ptype, rule) {
        const line = this.savePolicyLine(ptype, rule);
        this.policies.push(line);
        this.storePolicies(this.policies);
        //reSave the policies
    }

    async removePolicy(sec, ptype, rule) {
        let result = this.reducePolicies(this.policies, ptype, rule);
        //the modified policies
        if (result.length) { //if length>0
            this.policies = result;
            //Store in Redis
            this.storePolicies(this.policies);
        } else {
            // console.IN("No Policy found");
            throw new Error("No Policy Found");
        }
    }

    async removeFilteredPolicy(sec, ptype, fieldIndex, ...fieldValues) {
        return new Error("not implemented");
    }

}