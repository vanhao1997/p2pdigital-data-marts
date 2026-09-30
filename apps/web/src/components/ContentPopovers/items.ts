import {
  Video1GoogleSheetsReport,
  Video2LookerAsDestination,
  Video3GettingStartedDataMarts,
  Video4LegacyStorageSetup,
  Video5TryInsights,
  Video6EmailReports,
} from './popovers';
import type { PopoverConfig, PopoverId } from './types';

export const popoverItems: Record<PopoverId, PopoverConfig> = {
  'video-1-google-sheets': {
    width: 500,
    height: 410,
    position: 'bottom-left',
    titleKey: 'contentPopovers.sqlToSheets',
    content: Video1GoogleSheetsReport,
  },
  'video-2-looker': {
    width: 500,
    height: 410,
    position: 'bottom-left',
    titleKey: 'contentPopovers.dataStudioSetup',
    content: Video2LookerAsDestination,
  },
  'video-3-getting-started-with-data-marts': {
    width: 500,
    height: 355,
    position: 'bottom-left',
    titleKey: 'contentPopovers.gettingStarted',
    content: Video3GettingStartedDataMarts,
  },
  'video-4-legacy-storage-setup': {
    width: 500,
    height: 355,
    position: 'bottom-left',
    titleKey: 'contentPopovers.bigQuerySetup',
    content: Video4LegacyStorageSetup,
  },
  'video-5-try-insights': {
    width: 500,
    height: 355,
    position: 'bottom-left',
    titleKey: 'contentPopovers.insightsVideo',
    content: Video5TryInsights,
  },
  'video-6-email-reports': {
    width: 500,
    height: 355,
    position: 'bottom-left',
    titleKey: 'contentPopovers.emailReports',
    content: Video6EmailReports,
  },
};
