"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var helpers_1 = require("@maxxton/microdocs-core/helpers");
function default_1(env, projects, projectNodes, projectNodesFlat, current, currentNode) {
    var permissions = {};
    projectNodesFlat.forEach(function (projectNode) {
        var project = projects.filter(function (p) { return p.info.title === projectNode.title && p.info.version === projectNode.version; })[0];
        generatePermissionsForProject(project);
    });
    if (current) {
        generatePermissionsForProject(current);
    }
    function generatePermissionsForProject(project) {
        var paths = project.paths;
        var pathPermissions = [];
        var _loop_1 = function (path) {
            if (!path.includes('i18n') && (path.startsWith('/api/') || path.startsWith('/maxxton/'))) {
                var endpoint = buildPermissionsForPath(project, path, paths[path]);
                var endpointProperties_1 = endpoint.permissions;
                if (permissions[endpoint.pathName]) {
                    var storedProperties = permissions[endpoint.pathName];
                    endpointProperties_1.methods = endpointProperties_1.methods.concat(storedProperties.methods.filter(function (method) { return !endpointProperties_1.methods.includes(method); }));
                    endpointProperties_1.permissions = endpointProperties_1.permissions.concat(storedProperties.permissions.filter(function (permissions) { return !endpointProperties_1.permissions.includes(permissions); }));
                }
                pathPermissions[endpoint.pathName] = endpointProperties_1;
            }
        };
        for (var path in paths) {
            _loop_1(path);
        }
        pathPermissions = validatePermissions(pathPermissions);
        for (var permission in pathPermissions) {
            permissions[permission] = pathPermissions[permission];
        }
    }
    function buildPermissionsForPath(project, uri, path) {
        var regexUri = uri.replace(/{.*?}/g, '*');
        var routerPart = /^\/.+?\/(.+?)\/.*$/.exec(regexUri);
        if (routerPart && routerPart.length === 2) {
            regexUri = regexUri.replace(routerPart[1], '*');
        }
        regexUri = regexUri.endsWith('*') ? regexUri.substr(0, regexUri.length - 1) : regexUri;
        regexUri = regexUri.endsWith('/') ? regexUri + '**' : regexUri + '/**';
        var responseType = null;
        var methods = [];
        var permissions = [];
        for (var method in path) {
            var name = method.toUpperCase();
            if (!methods.includes(name)) {
                methods.push(method.toUpperCase());
            }
            var endpoint = path[method];
            for (var response in endpoint.responses) {
                var endpointResponse = endpoint.responses[response];
                for (var reference in endpointResponse.schema) {
                    var permissionList = findPermissions(project, endpointResponse.schema, reference);
                    if (permissionList !== null && permissionList.length > 0) {
                        permissionList.forEach(function (permission) {
                            permission = permission.replace(/\W+/g, '_').replace(/([a-z\d])([A-Z])/g, '$1_$2').toUpperCase();
                            if (!permissions.includes(permission)) {
                                permissions.push(permission);
                            }
                        });
                    }
                }
            }
        }
        var permissionEndpoint = {
            service: project.info.title,
            uri: regexUri,
            methods: methods,
            executable: false,
            permissions: permissions
        };
        return {
            pathName: regexUri.substr(1, regexUri.length).replace(/\/\*+/g, '').replace(/\//g, '-'),
            permissions: permissionEndpoint
        };
    }
    function findPermissions(project, schema, reference) {
        var permissions = [];
        if (reference == '$ref') {
            var result = helpers_1.SchemaHelper.collect(schema, [], project);
            if (result.name) {
                permissions.push(result.name);
            }
        }
        else {
            var newSchema = schema[reference];
            if (newSchema !== null && typeof newSchema === 'object') {
                for (var field in newSchema) {
                    permissions = permissions.concat(findPermissions(project, newSchema, field));
                }
            }
        }
        return permissions;
    }
    function validatePermissions(permissions) {
        if (permissions === null) {
            return permissions;
        }
        var pathStart = null;
        var missingPermissions = [];
        var permissionMap = {};
        for (var e in permissions) {
            var endpoint = permissions[e];
            if (endpoint.permissions.length > 0) {
                endpoint.permissions.forEach(function (permission) {
                    permissionMap[permission] = permissionMap[permission] ? permissionMap[permission] + 1 : 1;
                });
            }
            else {
                missingPermissions.push(e);
            }
            if (pathStart === null) {
                pathStart = e.split('-')[1].replace(/\W+/g, '_').replace(/([a-z\d])([A-Z])/g, '$1_$2').toUpperCase();
            }
        }
        var topCount = 0;
        var topPermission = pathStart;
        for (var permission in permissionMap) {
            var count = permissionMap[permission];
            if (count > topCount) {
                topCount = count;
                topPermission = permission;
            }
        }
        missingPermissions.forEach(function (permission) {
            permissions[permission].permissions.push(topPermission);
        });
        return permissions;
    }
    return {
        extension: 'yml',
        body: {
            maxxton: {
                permissions: {
                    endpoints: permissions
                }
            }
        }
    };
}
exports.default = default_1;
;