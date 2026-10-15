targetScope = 'subscription'

@description('Azure region for the resource group and Static Web App.')
param location string = 'japaneast'

@description('Resource group that contains the Static Web App.')
param resourceGroupName string

@description('Globally unique Static Web App name.')
param staticSiteName string

@description('Deployment environment label used for resource tags.')
param environment string = 'production'

var tags = {
  application: 'ai-skill-catalog'
  environment: environment
  managedBy: 'bicep'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module staticWebApp './static-site.bicep' = {
  name: 'static-site-${uniqueString(resourceGroup.id, staticSiteName)}'
  scope: resourceGroup
  params: {
    location: location
    staticSiteName: staticSiteName
    environment: environment
  }
}

output resourceGroupName string = resourceGroup.name
output staticSiteName string = staticWebApp.outputs.staticSiteName
output defaultHostname string = staticWebApp.outputs.defaultHostname
