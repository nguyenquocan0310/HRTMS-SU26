import type {
  TournamentBasicInfo,
  PrizeRow,
  Round,
} from './TournamentBuilder';

export type BasicFieldErrors = Partial<
  Record<keyof TournamentBasicInfo, string>
>;

export type PrizeFieldErrors = Record<number, string>;

export interface RaceFieldErrors {
  scheduledDate?: string;
  scheduledTime?: string;
  purseAmount?: string;
  raceDistanceOverride?: string;
}

export interface RoundFieldErrors {
  name?: string;
  scheduledDate?: string;
  races?: Record<string, RaceFieldErrors>;
}

export type RoundsFieldErrors = Record<string, RoundFieldErrors>;

export interface PrizeValidationResult {
  fieldErrors: PrizeFieldErrors;
  structureErrors: string[];
}

export interface RoundsValidationResult {
  fieldErrors: RoundsFieldErrors;
  structureErrors: string[];
}

const VALID_BREEDS = [
  'Thoroughbred',
  'Arabian',
  'Quarter Horse',
  'Mixed',
];

const VALID_TRACK_TYPES = [
  'Turf',
  'Dirt',
  'Synthetic',
];

const VALID_RACE_CATEGORIES = [
  'Open',
  'Classic',
  'Maiden',
];

const getTodayLocal = (): string => {
  const currentDate = new Date();

  const localDate = new Date(
    currentDate.getTime() -
      currentDate.getTimezoneOffset() * 60_000
  );

  return localDate.toISOString().slice(0, 10);
};

/**
 * Validation khớp với:
 * - CreateTournamentDto
 * - TournamentService.CreateTournamentAsync
 * - TournamentService.UpdateTournamentAsync
 */
export const validateBasicInfo = (
  data: TournamentBasicInfo,
  isCreateMode: boolean
): BasicFieldErrors => {
  const errors: BasicFieldErrors = {};

  const trimmedName = data.name.trim();

  if (!trimmedName) {
    errors.name = 'Vui lòng nhập tên giải đấu.';
  } else if (data.name.length > 200) {
    errors.name =
      'Tên giải đấu không được vượt quá 200 ký tự.';
  }

  if (!data.startDate) {
    errors.startDate = 'Vui lòng chọn ngày bắt đầu.';
  } else if (
    isCreateMode &&
    data.startDate < getTodayLocal()
  ) {
    errors.startDate =
      'Ngày bắt đầu không được ở quá khứ.';
  }

  if (!data.endDate) {
    errors.endDate = 'Vui lòng chọn ngày kết thúc.';
  } else if (
    data.startDate &&
    data.endDate <= data.startDate
  ) {
    errors.endDate =
      'Ngày kết thúc phải sau ngày bắt đầu.';
  }

  if (!data.allowedBreed) {
    errors.allowedBreed =
      'Vui lòng chọn giống ngựa được phép.';
  } else if (
    !VALID_BREEDS.includes(data.allowedBreed)
  ) {
    errors.allowedBreed =
      'Giống ngựa được chọn không hợp lệ.';
  }

  if (!data.trackType) {
    errors.trackType =
      'Vui lòng chọn loại đường đua.';
  } else if (
    !VALID_TRACK_TYPES.includes(data.trackType)
  ) {
    errors.trackType =
      'Loại đường đua được chọn không hợp lệ.';
  }

  if (data.raceDistance === '') {
    errors.raceDistance =
      'Vui lòng nhập cự ly cuộc đua.';
  } else if (
    !Number.isInteger(data.raceDistance) ||
    data.raceDistance <= 1200 ||
    data.raceDistance >= 2400
  ) {
    errors.raceDistance =
      'Cự ly phải lớn hơn 1.200m và nhỏ hơn 2.400m.';
  }

  if (!data.raceCategory) {
    errors.raceCategory =
      'Vui lòng chọn hạng đua.';
  } else if (
    !VALID_RACE_CATEGORIES.includes(
      data.raceCategory
    )
  ) {
    errors.raceCategory =
      'Hạng đua được chọn không hợp lệ.';
  }

  if (data.maxHorses === '') {
    errors.maxHorses =
      'Vui lòng nhập số ngựa tối đa.';
  } else if (
    !Number.isInteger(data.maxHorses) ||
    data.maxHorses <= 0
  ) {
    errors.maxHorses =
      'Số ngựa tối đa phải là số nguyên lớn hơn 0.';
  }

  if (data.minJockeyExperienceYears === '') {
    errors.minJockeyExperienceYears =
      'Vui lòng nhập số năm kinh nghiệm tối thiểu.';
  } else if (
    !Number.isInteger(
      data.minJockeyExperienceYears
    ) ||
    data.minJockeyExperienceYears < 0 ||
    data.minJockeyExperienceYears > 50
  ) {
    errors.minJockeyExperienceYears =
      'Số năm kinh nghiệm phải là số nguyên từ 0 đến 50.';
  }

  if (data.purseAmount === '') {
    errors.purseAmount =
      'Vui lòng nhập tổng quỹ thưởng.';
  } else if (data.purseAmount < 0) {
    errors.purseAmount =
      'Tổng quỹ thưởng không được âm.';
  }

  if (data.entryFeeAmount < 0) {
    errors.entryFeeAmount =
      'Lệ phí tham gia không được âm.';
  }

  if (data.preRaceWeightThresholdKg <= 0) {
    errors.preRaceWeightThresholdKg =
      'Ngưỡng cân trước đua phải lớn hơn 0.';
  }

  if (
    data.postRaceWeightDiffThresholdKg <= 0
  ) {
    errors.postRaceWeightDiffThresholdKg =
      'Ngưỡng chênh cân sau đua phải lớn hơn 0.';
  }

  return errors;
};

/**
 * Validation khớp với:
 * - SetPrizeDistributionDto
 * - PrizeItemDto
 * - TournamentService.SetPrizeDistributionsAsync
 */
export const validatePrizeDistribution = (
  rows: PrizeRow[]
): PrizeValidationResult => {
  const fieldErrors: PrizeFieldErrors = {};
  const structureErrors: string[] = [];

  const positions = rows
    .map((row) => row.rank)
    .sort((a, b) => a - b);

  const hasCorrectPositions =
    rows.length === 5 &&
    positions.join(',') === '1,2,3,4,5';

  if (!hasCorrectPositions) {
    structureErrors.push(
      'Phải có đúng 5 vị trí từ Top 1 đến Top 5 và không được trùng.'
    );
  }

  rows.forEach((row) => {
    if (
      row.percentage < 0.01 ||
      row.percentage > 100
    ) {
      fieldErrors[row.rank] =
        `Tỷ lệ của Top ${row.rank} phải từ 0,01% đến 100%.`;
    }
  });

  const total = rows.reduce(
    (sum, row) => sum + row.percentage,
    0
  );

  const roundedTotal =
    Math.round(total * 100) / 100;

  if (roundedTotal !== 100) {
    structureErrors.push(
      `Tổng tỷ lệ phải bằng 100%, hiện tại là ${roundedTotal}%.`
    );
  }

  return {
    fieldErrors,
    structureErrors,
  };
};

/**
 * Validation khớp với:
 * - CreateRoundDto
 * - CreateRaceDto
 * - TournamentService.CreateRoundAsync
 * - TournamentService.CreateRaceAsync
 */
export const validateRounds = (
  rounds: Round[],
  basicInfo: TournamentBasicInfo
): RoundsValidationResult => {
  const fieldErrors: RoundsFieldErrors = {};
  const structureErrors: string[] = [];

  let totalRacePurse = 0;

  if (rounds.length > 100) {
    structureErrors.push(
      'Giải đấu chỉ cho phép tối đa 100 vòng.'
    );
  }

  rounds.forEach((round, roundIndex) => {
    const roundErrors: RoundFieldErrors = {
      races: {},
    };

    const roundLabel =
      round.name.trim() ||
      `Round ${roundIndex + 1}`;

    if (!round.name.trim()) {
      roundErrors.name =
        'Vui lòng nhập tên vòng đấu.';
    } else if (round.name.length > 100) {
      roundErrors.name =
        'Tên vòng đấu không được vượt quá 100 ký tự.';
    }

    if (!round.scheduledDate) {
      roundErrors.scheduledDate =
        'Vui lòng chọn ngày diễn ra vòng đấu.';
    } else if (
      basicInfo.startDate &&
      round.scheduledDate <
        basicInfo.startDate
    ) {
      roundErrors.scheduledDate =
        'Ngày vòng đấu không được sớm hơn ngày bắt đầu giải.';
    } else if (
      basicInfo.endDate &&
      round.scheduledDate >
        basicInfo.endDate
    ) {
      roundErrors.scheduledDate =
        'Ngày vòng đấu không được muộn hơn ngày kết thúc giải.';
    }

    const previousRound =
      rounds[roundIndex - 1];

    if (
      previousRound?.scheduledDate &&
      round.scheduledDate &&
      round.scheduledDate <=
        previousRound.scheduledDate
    ) {
      structureErrors.push(
        `${roundLabel} phải diễn ra sau vòng trước.`
      );
    }

    const raceNumbers =
      new Set<number>();

    round.races.forEach((race) => {
      const raceErrors: RaceFieldErrors = {};

      totalRacePurse +=
        Number(race.purseAmount) || 0;

      if (
        !Number.isInteger(race.raceNumber) ||
        race.raceNumber < 1
      ) {
        structureErrors.push(
          `Số cuộc đua trong ${roundLabel} phải là số nguyên lớn hơn 0.`
        );
      }

      if (
        raceNumbers.has(race.raceNumber)
      ) {
        structureErrors.push(
          `Race #${race.raceNumber} bị trùng trong ${roundLabel}.`
        );
      }

      raceNumbers.add(race.raceNumber);

      if (!race.scheduledDate) {
        raceErrors.scheduledDate =
          'Vui lòng chọn ngày đua.';
      } else if (
        basicInfo.startDate &&
        race.scheduledDate <
          basicInfo.startDate
      ) {
        raceErrors.scheduledDate =
          'Ngày đua không được sớm hơn ngày bắt đầu giải.';
      } else if (
        basicInfo.endDate &&
        race.scheduledDate >
          basicInfo.endDate
      ) {
        raceErrors.scheduledDate =
          'Ngày đua không được muộn hơn ngày kết thúc giải.';
      } else if (
        round.scheduledDate &&
        race.scheduledDate <
          round.scheduledDate
      ) {
        raceErrors.scheduledDate =
          'Ngày đua không được sớm hơn ngày của vòng.';
      }

      if (!race.scheduledTime) {
        raceErrors.scheduledTime =
          'Vui lòng chọn giờ đua.';
      } else if (race.scheduledDate) {
        const scheduledDateTime =
          new Date(
            `${race.scheduledDate}T${race.scheduledTime}:00`
          );

        if (
          !Number.isNaN(
            scheduledDateTime.getTime()
          ) &&
          scheduledDateTime <= new Date()
        ) {
          raceErrors.scheduledTime =
            'Thời gian thi đấu phải ở tương lai.';
        }
      }

      if (race.purseAmount === '') {
        raceErrors.purseAmount =
          'Vui lòng nhập quỹ thưởng của cuộc đua.';
      } else if (race.purseAmount < 0) {
        raceErrors.purseAmount =
          'Quỹ thưởng cuộc đua không được âm.';
      }

      if (
        race.raceDistanceOverride !== ''
      ) {
        if (
          !Number.isInteger(
            race.raceDistanceOverride
          ) ||
          race.raceDistanceOverride <= 1200 ||
          race.raceDistanceOverride >= 2400
        ) {
          raceErrors.raceDistanceOverride =
            'Cự ly ghi đè phải lớn hơn 1.200m và nhỏ hơn 2.400m.';
        }
      }

      if (
        Object.keys(raceErrors).length > 0
      ) {
        roundErrors.races![
          race.id
        ] = raceErrors;
      }
    });

    if (
      Object.keys(roundErrors.races ?? {})
        .length === 0
    ) {
      delete roundErrors.races;
    }

    if (
      Object.keys(roundErrors).length > 0
    ) {
      fieldErrors[round.id] =
        roundErrors;
    }
  });

  if (
    typeof basicInfo.purseAmount ===
      'number' &&
    totalRacePurse >
      basicInfo.purseAmount
  ) {
    structureErrors.push(
      `Tổng quỹ thưởng các Race (${totalRacePurse.toLocaleString(
        'vi-VN'
      )} VNĐ) vượt quỹ toàn giải (${basicInfo.purseAmount.toLocaleString(
        'vi-VN'
      )} VNĐ).`
    );
  }

  return {
    fieldErrors,
    structureErrors,
  };
};

export const hasBasicErrors = (
  errors: BasicFieldErrors
): boolean =>
  Object.keys(errors).length > 0;

export const hasPrizeErrors = (
  result: PrizeValidationResult
): boolean =>
  Object.keys(result.fieldErrors).length >
    0 ||
  result.structureErrors.length > 0;

export const hasRoundsErrors = (
  result: RoundsValidationResult
): boolean =>
  Object.keys(result.fieldErrors).length >
    0 ||
  result.structureErrors.length > 0;