import { Helper } from 'casbin';
import * as redis from 'redis';
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
    private policies= null;
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
    storePolicies(policies){
        new Promise((resolve, reject) => {
            this.redisInstance.DEL("policies");
            this.redisInstance.SET("policies", JSON.stringify(policies), (err, reply) => {
                if (err) {
                    console.error("Redis Save error",err);
                    reject;
                } else {
                    console.log(reply);
                    resolve;
                }
            })
        });
    }

    reducePolicies(policies,ptype,rule){
        let i=rule.length;
        let policyIndex = policies.fieldIndex((policy)=>{
            let flag= false;
            flag =  policy.p_type    === ptype  ? true  : false;
            flag =  i>5 && policy.v5 === rule[5] ? true : false;
            flag =  i>4 && policy.v4 === rule[4] ? true : false ;
            flag =  i>3 && policy.v3 === rule[3] ? true : false ;
            flag =  i>2 && policy.v2 === rule[2] ? true : false ;
            flag =  i>1 && policy.v0 === rule[1] ? true : false ; 
            return flag;
        });
        if(policyIndex!==-1){
            return policies.splice(policyIndex,1);
        }
        return [];
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
                this.policies=policies;//For add and remove policies methods
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
        this.storePolicies(policies);
    }
    async addPolicy(sec, ptype, rule) {
        const line = this.savePolicyLine(ptype, rule);
        this.policies.push(line);
        this.storePolicies(this.policies);
        //reSave the policies
    }

    async removePolicy(sec, ptype, rule) {
        let result=this.reducePolicies(this.policies, ptype,rule);
        //the modified policies
        if(result.length){ //if length>0
            this.policies=result;
            //Store in Redis
            this.storePolicies(this.policies);
        }else{
            console.log("No Policy found");
        }
    }

    async removeFilteredPolicy(sec, ptype, fieldIndex, ...fieldValues) {
        return new Error("not implemented");
    }

}