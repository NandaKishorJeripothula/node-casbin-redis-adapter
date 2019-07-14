const { Helper } = require("casbin");
const redis = require("redis");
const { Adapter, CasbinRule } = require("./definitions");

/**
 * Implements a policy adapter for casbin with redis support.
 *
 * @class
 */

class nodeRedisAdapter {
    /**
     * Creates a new instance of redis adapter for casbin.
     * It does wait for successfull connection to redis.
     * So, if you want to have a possibility to wait until connection successful, use newAdapter instead.
     *
     * @constructor
     * @param {Object} [options={}] Options to pass on to redis client.
     * The following are the memebrs of the options interface.
     * @param {String} host
     * @param {Number} port
     * @param {String} url
     * @param {String} password
     * @param {String} db
     * If the connection is SSL Encrypted then TCL object
     * @param {Object} tcl
     * @example
     * const adapter = new nodeRedisAdapter({host,port[,password, db]});
     * @example
     * const adapter = new nodeRedisAdapter({url[,password, db, tcl]});
     */
    constructor(options) {
        let adapter = redis.createClient({
            ...options,
            retry_strategy: function (options) {
                if (options.error && options.error.code === "ECONNREFUSED") {
                    // End reconnecting on a specific error and flush all commands with
                    // a individual error
                    return new Error("The server refused the connection");
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    // End reconnecting after a specific timeout and flush all commands
                    // with a individual error
                    return new Error("Retry time exhausted");
                }
                if (options.attempt > 10) {
                    // End reconnecting with built in error
                    return undefined;
                }
                // reconnect after
                return Math.min(options.attempt * 100, 3000);
            }
        });
        this.isFiltered = false;
        this.redisInstance = adapter;
    }
    /**
     * Creates a new instance of redis adapter for casbin.
     * It does the same as newAdapter, but it also sets a flag that this adapter is in filtered state.
     * That way, casbin will not call loadPolicy() automatically.
     *
     *
     * @static
     * @param {Object} [options={}] Options to pass on to redis client.
     * The following are the memebrs of the options interface.
     * @param {String} host
     * @param {Number} port
     * @param {String} url
     * @param {String} password
     * @param {String} db
     * If the connection is SSL Encrypted then TCL object
     * @param {Object} tcl
     * @example
     * const adapter = new nodeRedisAdapter.newFilteredAdapter({host,port[,password, db]});
     * @example
     * const adapter = new nodeRedisAdapter.newFilteredAdapter({url[,password, db, tcl]});
     */
    static async newFilteredAdapter(options) {
        const adapter = await nodeRedisAdapter(options);
        adapter.setFiltered(true);
        return adapter;
    }
    /**
     * Switch adapter to (non)filtered state.
     * Casbin uses this flag to determine if it should load the whole policy from DB or not.
     *
     * @param {Boolean} [isFiltered=true] Flag that represents the current state of adapter (filtered or not)
     */
    setFiltered(isFiltered = true) {
        this.isFiltered = isFiltered;
    }

    /**
     * Loads one policy rule into casbin model.
     * This method is used by casbin and should not be called by user.
     *
     * @param {Object} line Record with one policy rule from redis
     * @param {Object} model Casbin model to which policy rule must be loaded
     */
    loadPolicyLine(line, model) {
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
    /**
     * Implements the process of loading policy from redis database into enforcer.
     * This method is used by casbin and should not be called by user.
     *
     * @param {Model} model Model instance from enforcer
     * @returns {Promise<void>}
     */
    async loadPolicy(model) {
        // const lines = this.redisInstance.
        const lines = this.redisInstance.HGETALL("policy", (err, obj) => {
            if (!err) {
                Object.keys(lines).forEach(function (i) {
                    this.loadPolicyLine(lines[i], model);
                });
            } else {
                return err;
            }
        });
    }

    /**
     * Persists one policy rule into redis.
     * This method is used by casbin and should not be called by user.
     *
     * @param {String} ptype Policy type to save into Redis
     * @param {Array<String>} rule An array which consists of policy rule elements to store
     * @returns {Object} Returns a created CasbinRule record for Redis
     */
    savePolicyLine(ptype, rule) {
        // const model = new CasbinRule({ p_type: ptype });
        let line = {};
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
    /**
     * Implements the process of saving policy from enforcer into database.
     * This method is used by casbin and should not be called by user.
     *
     * @param {Model} model Model instance from enforcer
     * @returns {Promise<Boolean>}
     */
    async savePolicy(model) {
        /**
         * TODO 
         * Check whether the HMSET over-writes the data or copies are created 
         */
        const policyRuleAST = model.model.get("p");
        const groupingPolicyAST = model.model.get("g");
        const lines = {};
        for (const [ptype, ast] of policyRuleAST) {
            for (const rule of ast.policy) {
                const line = this.savePolicyLine(ptype, rule);
                // await line.save();
                lines = { ...lines, line };
            }
        }

        for (const [ptype, ast] of groupingPolicyAST) {
            for (const rule of ast.policy) {
                const line = this.savePolicyLine(ptype, rule);
                lines = { ...lines, line };
            }
        }
        const policy = JSON.stringify(lines);
        this.redisInstance.HMSET(policy, policy, () => {
            return true;
        });
        return false;
    }


    /**
     * Implements the process of adding policy rule.
     * This method is used by casbin and should not be called by user.
     *
     * @param {String} sec Section of the policy
     * @param {String} ptype Type of the policy (e.g. "p" or "g")
     * @param {Array<String>} rule Policy rule to add into enforcer
     * @returns {Promise<void>}
     */
    async addPolicy(sec, ptype, rule) {
        /**
         * TODO 
         * Check whether the HMSET over-writes the data or copies are created 
         */
        const line = this.savePolicyLine(ptype, rule);
        const lines = this.redisInstance.HGETALL("policy", (err, obj) => {
            if (!err) {
                return obj;
            } else {
                return err;
            }
        });
        lines = { ...lines, line };
        const policy = JSON.stringify(lines);
        this.redisInstance.HMSET(policy, policy, () => {
            return true;
        });
        return false;
    }

    /**
     * Implements the process of removing policy rule.
     * This method is used by casbin and should not be called by user.
     *
     * @param {String} sec Section of the policy
     * @param {String} ptype Type of the policy (e.g. "p" or "g")
     * @param {Array<String>} rule Policy rule to remove from enforcer
     * @returns {Promise<void>}
     */
    async removePolicy(sec, ptype, rule) {
        return new Error("not implemented");
    }
    /**
     * TODO: RemoveFilteredPolicy
     */
    async removeFilteredPolicy(sec, ptype, fieldIndex, ...fieldValues) {
        return new Error("not implemented");
    }
    async close() {
        if (this.redisInstance && this.redisInstance.connected) {
            this.redisInstance.quit();
        }
    }

}
module.exports = nodeRedisAdapter;
