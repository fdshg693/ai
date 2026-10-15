targetScope = 'resourceGroup'

@description('Azure region for the Static Web App.')
param location string

@description('Globally unique Static Web App name.')
param staticSiteName string

@description('Deployment environment label used for resource tags.')
param environment string = 'production'

var tags = {
  application: 'ai-skill-catalog'
  environment: environment
  managedBy: 'bicep'
}

resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: staticSiteName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
  tags: tags
}

output staticSiteName string = staticWebApp.name
output defaultHostname string = staticWebApp.properties.defaultHostname
