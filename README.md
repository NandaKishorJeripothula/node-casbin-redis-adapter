

## Role 
Role is defined for testing purpose in the ```authorization.middleware.ts``` in ```authz()``` method.
You can override this is the regular api call or in a curl 

```javascript
req.headers.user = 'admin';
```
## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```


## Test Casbin

``` bash
curl -X GET -H "user:admin" http://localhost:3000
``` 
must return ```Hello World```.


``` bash 
curl -X POST -H "user:admin" http://localhost:3000
curl -X GET -H "user:notadmin" http://localhost:3000
```
should return ``` { "403": "Forbidden"}``` 
## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
