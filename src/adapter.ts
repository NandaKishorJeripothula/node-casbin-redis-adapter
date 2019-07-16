import { Helper } from 'casbin';
import * as redis from 'redis';
import { async } from 'rxjs/internal/scheduler/async';
class Line {
    p_type: String;
    v0: String;
    v1: String;
    v2: String;
    v3: String;
    v4: String;
    v5: String;
}
export class NodeRedisAdapter {
    private redisInstance = null;
    /**
     * 
     * Helper Methods
     */
    createClient(options) {
        this.redisInstance = redis.createClient(
            {
                ...options,
                retry_strategy: function (options) {
                    if (options.error && options.error.code === "ECONNREFUSED") {
                        console.error("The server refused the connection");
                        return new Error("The server refused the connection");
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        console.error("Retry time exhausted");
                        return new Error("Retry time exhausted");
                    }
                    if (options.attempt > 10) {
                        console.log("End reconnecting with built in error");
                        return undefined;
                    }
                    // reconnect after
                    return Math.min(options.attempt * 100, 300);
                }
            }
        );
    }
    savePolicyLine(ptype, rule) {
        let line = new Line();
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
        console.log("Generated Policy Line \n", line);
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
    constructor(options: Object) {
        this.createClient(options);
    }
    static async newAdapter(options: Object) {
        const adapter = new NodeRedisAdapter(options);
        await new Promise(resolve => adapter.redisInstance.on('connect', resolve));
        return adapter;
    }
    /**
     * Adapter Methods
     */

    async loadPolicy(model) {
        this.redisInstance.GET("policies", (err, policies) => {
            var AdapterRef=this;
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
                policies=JSON.parse(policies);
                console.log(policies, typeof policies);
                policies.forEach(function (policy,index) {
                    console.log(policy)
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
        const policy = JSON.stringify(policies);
        new Promise((resolve, reject) => {
            this.redisInstance.DEL("policies");
            this.redisInstance.HMSET("policies", policies, (err, reply) => {
                if (err) {
                    console.error(err);
                    reject;
                } else {
                    console.log(reply);
                    resolve;
                }
            })
        });
    }
    async addPolicy(sec, ptype, rule) {
        return new Error("not implemented");
    }

    async removePolicy(sec, ptype, rule) {
        
        return new Error("not implemented");
    }

    async removeFilteredPolicy(sec, ptype, fieldIndex, ...fieldValues) {
        return new Error("not implemented");
    }

}