-- Per-user download va import limit override (null = reja default)
ALTER TABLE "PluginProfile" ADD COLUMN "downloadLimitOverride" INTEGER;
ALTER TABLE "PluginProfile" ADD COLUMN "importLimitOverride" INTEGER;
