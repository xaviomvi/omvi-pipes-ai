export const storageEtcdPaths = {
    storageType: '/services/storage_service/storage_type',
    s3: '/services/storage_service/storage/s3',
    azureBlob: '/services/storage_service/storage/azureBlob',
    local: '/services/storage_service/storage/local',
    endpoint: '/services/storage_service/storage/endpoint',
}

export const maxFileSizeForPipesHubService = 10 * 1024 * 1024;