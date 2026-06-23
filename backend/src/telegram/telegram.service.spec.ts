import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
import { TelegramService } from './telegram.service';
import { ChartScreenshotService } from './chart-screenshot.service';
import { Setting } from '../settings/setting.entity';

describe('TelegramService', () => {
  let service: TelegramService;
  let settingsRepoMock: any;
  let chartScreenshotMock: any;
  let moduleRefMock: any;

  beforeEach(async () => {
    settingsRepoMock = {
      findOneBy: jest.fn().mockResolvedValue(null),
    };
    chartScreenshotMock = {
      generate: jest.fn().mockResolvedValue(null),
    };
    moduleRefMock = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        {
          provide: ChartScreenshotService,
          useValue: chartScreenshotMock,
        },
        {
          provide: getRepositoryToken(Setting),
          useValue: settingsRepoMock,
        },
        {
          provide: ModuleRef,
          useValue: moduleRefMock,
        },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should return false if bot or chatId is missing', () => {
      expect(service.isConfigured()).toBe(false);
    });
  });
});
