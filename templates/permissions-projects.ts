import { Project, Path, ProjectNode, FlatList } from "@maxxton/microdocs-core/domain";
import { SchemaHelper } from "@maxxton/microdocs-core/helpers";

declare var extention:string;

export default function ( env:string, projects:Project[], projectNodes:ProjectNode[], projectNodesFlat:ProjectNode[], current:Project, currentNode?:ProjectNode ):any {
  let permissions:any = {};

  projectNodesFlat.forEach( ( projectNode:ProjectNode ) => {
    let project     = projects.filter( p => p.info.title === projectNode.title && p.info.version === projectNode.version )[ 0 ];
    generatePermissionsForProject(project);
  });

  if ( current ) {
    generatePermissionsForProject(current);
  }

  // generate permission for a Project
  function generatePermissionsForProject(project: Project) {
    let paths       = project.paths;
    let pathPermissions: any[] = [];
    for(let path in paths){
      // For each path check if it should have permissions
      if(!path.includes('i18n') && (path.startsWith('/api/') || path.startsWith('/maxxton/'))){
        let endpoint:any = buildPermissionsForPath(project, path, paths[path] );
        let endpointProperties = endpoint.permissions;
        // If the name of the path is already present, merge it with the existing result.
        if(permissions[endpoint.pathName]){
          let storedProperties = permissions[endpoint.pathName];
          endpointProperties.methods = endpointProperties.methods.concat(storedProperties.methods.filter((method:string) => !endpointProperties.methods.includes(method)));
          endpointProperties.permissions = endpointProperties.permissions.concat(storedProperties.permissions.filter((permissions:string) => !endpointProperties.permissions.includes(permissions)));
        }
        pathPermissions[endpoint.pathName] = endpointProperties;
      }
    }
    // Check the similiar path collection for missing permissions
    pathPermissions = validatePermissions(pathPermissions);
    for(let permission in pathPermissions) {
      permissions[permission] = pathPermissions[permission];
    }
  }

  // build permissions for a specific path
  function buildPermissionsForPath(project: Project, uri: string, path:Path ):any {
    // replace every dynamic parameter in the path with an astrix. 
    let regexUri = uri.replace(/{.*?}/g, '*');
    let routerPart = /^\/.+?\/(.+?)\/.*$/.exec(regexUri);
    if(routerPart && routerPart.length === 2){
      regexUri = regexUri.replace(routerPart[1], '*');
    }
    // Make sure the suffix of the path equals '/**'
    regexUri = regexUri.endsWith('*') ? regexUri.substr(0, regexUri.length-1): regexUri;
    regexUri = regexUri.endsWith('/') ? regexUri + '**' : regexUri + '/**';

    let responseType = null;
    let methods:string[] = [];
    let permissions:string[] = [];
    for(let method in path){
      // Fetch all methods allowed on the endpoint
      let name = method.toUpperCase();
      if(!methods.includes(name)){
        methods.push(method.toUpperCase());
      }
      // Check the path response for a return type and base the name of permission on that.
      let endpoint = path[method];
      for(let response in endpoint.responses){
        let endpointResponse = endpoint.responses[response];
        for (var reference in endpointResponse.schema) {
          let permissionList: string[] = findPermissions(project, endpointResponse.schema, reference);
          if(permissionList !== null && permissionList.length > 0) {
            permissionList.forEach( (permission: string) => {
              permission = permission.replace(/\W+/g, '_').replace(/([a-z\d])([A-Z])/g, '$1_$2').toUpperCase();
              if(!permissions.includes(permission)) {
                permissions.push(permission);
              }
            });
          }
        }
      }
    }

    // Build the permission and return it along with the pathName
    let permissionEndpoint:any = {
      uri: regexUri,
      methods: methods,
      executable: false,
      permissions: permissions
    };

    return {
      pathName: regexUri.substr(1, regexUri.length).replace(/\/\*+/g, '').replace(/\//g, '-'),
      permissions: permissionEndpoint
    }
  }

  // Find any reference to a return type in the response field
  function findPermissions(project: Project, schema: any, reference:string): string[] {
    let permissions: string[] = [];
    // Check if the response type reference exists on the current level.
    if(reference == '$ref'){
      let result = SchemaHelper.collect(schema, [], project);
      if(result.name) {
        permissions.push(result.name);
      }
    }else{
      // Otherwise recurrsivly travel trough all objects 
      let newSchema = schema[reference];
      if(newSchema !== null && typeof newSchema === 'object'){
        for(let field in newSchema){
          permissions = permissions.concat(findPermissions(project, newSchema, field));
        }
      }
    }
    return permissions;
  }

  // Validate the permissions to see if anything is missing.
  function validatePermissions(permissions: any[]): any[] {
    if(permissions === null){
      return permissions;
    }

    // Build a map of the most used permissions for a path collection
    let pathStart: any = null;
    let missingPermissions: any[] = [];
    let permissionMap: any = {};
    for(let e in permissions){
      let endpoint = permissions[e];
      // Check if the path has permissios, otherwise add it to the missing permissions list.
      if(endpoint.permissions.length > 0){
        endpoint.permissions.forEach( (permission: string) => {
          permissionMap[permission] = permissionMap[permission] ? permissionMap[permission] + 1 : 1;
        });
      }else{
        missingPermissions.push(e);
      }

      // In case the collection has no similiar endpoints fetch the permission from the pathName
      if(pathStart === null){
        pathStart = e.split('-')[1].replace(/\W+/g, '_').replace(/([a-z\d])([A-Z])/g, '$1_$2').toUpperCase();
      }
    }

    // Get the permission with the highest occurance and mark it the topPermission
    let topCount = 0;
    let topPermission: string = pathStart;
    for(let permission in permissionMap){
      let count = permissionMap[permission];
      if(count > topCount){
        topCount = count;
        topPermission = permission;
      }
    }

    // Iterate though the list of paths with missing permissions and assign the top permission.
    missingPermissions.forEach( ( permission ) => {
      permissions[permission].permissions.push(topPermission);
    });

    return permissions;
  }

  // Return docker compose as an object
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
};
