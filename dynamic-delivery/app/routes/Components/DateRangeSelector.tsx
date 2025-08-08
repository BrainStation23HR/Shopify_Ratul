import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Popover,
  RadioButton,
  Text,
  TextField,
} from '@shopify/polaris';
import { CalendarIcon } from '@shopify/polaris-icons';

type DateRange = {
  startDate: string;
  endDate: string;
};

type DateRangeSelectorProps = {
  setFilter: (filter: DateRange) => void;
  initialRange?: DateRange;
};

const createDateRange = (startDate: Date, endDate: Date): DateRange => {
  // Create dates in local timezone to avoid UTC issues
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Format as YYYY-MM-DD in local timezone
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  return {
    startDate: startStr,
    endDate: endStr
  };
};

const formatDateForDisplay = (dateString: string): string => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const dayStr = String(date.getDate()).padStart(2, '0');
  const monthStr = String(date.getMonth() + 1).padStart(2, '0');
  const yearStr = date.getFullYear();
  return `${dayStr}/${monthStr}/${yearStr}`;
};

const useFilterOptions = () => {
  return useMemo(() => {
    const today = new Date();

    return {
      today: {
        value: 'today',
        label: 'Today',
        getDateRange: () => createDateRange(today, today)
      },
      yesterday: {
        value: 'yesterday',
        label: 'Yesterday',
        getDateRange: () => {
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          return createDateRange(yesterday, yesterday);
        }
      },
      last7: {
        value: 'last7',
        label: 'Last 7 days',
        getDateRange: () => {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 6);
          return createDateRange(sevenDaysAgo, today);
        }
      },
      last30: {
        value: 'last30',
        label: 'Last 30 days',
        getDateRange: () => {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 29);
          return createDateRange(thirtyDaysAgo, today);
        }
      },
      last90: {
        value: 'last90',
        label: 'Last 90 days',
        getDateRange: () => {
          const ninetyDaysAgo = new Date(today);
          ninetyDaysAgo.setDate(today.getDate() - 89);
          return createDateRange(ninetyDaysAgo, today);
        }
      },
      last12months: {
        value: 'last12months',
        label: 'Last 12 months',
        getDateRange: () => {
          const twelveMonthsAgo = new Date(today);
          twelveMonthsAgo.setMonth(today.getMonth() - 12);
          return createDateRange(twelveMonthsAgo, today);
        }
      },
      custom: {
        value: 'custom',
        label: 'Custom',
        getDateRange: () => {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(today.getDate() - 29);
          return createDateRange(thirtyDaysAgo, today);
        }
      }
    };
  }, []);
};

enum FILTERS {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST7 = 'last7',
  LAST30 = 'last30',
  LAST90 = 'last90',
  LAST12MONTHS = 'last12months',
  CUSTOM = 'custom',
}

const FILTERS_LABELS = [
  { value: FILTERS.TODAY, label: 'Today' },
  { value: FILTERS.YESTERDAY, label: 'Yesterday' },
  { value: FILTERS.LAST7, label: 'Last 7 days' },
  { value: FILTERS.LAST30, label: 'Last 30 days' },
  { value: FILTERS.LAST90, label: 'Last 90 days' },
  { value: FILTERS.LAST12MONTHS, label: 'Last 12 months' },
  { value: FILTERS.CUSTOM, label: 'Custom' },
];

export default function DateRangeSelector({
                                            setFilter,
                                            initialRange
                                          }: DateRangeSelectorProps) {
  const filterOptions = useFilterOptions();

  // Initialize with provided range or default to last 30 days
  const getInitialFilter = () => {
    if (initialRange) {
      // Check if initial range matches any predefined filter
      for (const [key, option] of Object.entries(filterOptions)) {
        if (key !== 'custom') {
          const range = option.getDateRange();
          if (range.startDate === initialRange.startDate &&
            range.endDate === initialRange.endDate) {
            return option;
          }
        }
      }
      // If no match, it's a custom range
      return filterOptions.custom;
    }
    return filterOptions.last30;
  };

  const [active, setActive] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(getInitialFilter());
  const [customDateRange, setCustomDateRange] = useState(
    initialRange || filterOptions.last30.getDateRange()
  );

  const toggleActive = () => setActive((prev) => !prev);

  const handleRadioChange = (value: string) => {
    const newFilter = Object.values(filterOptions).find(
      option => option.value === value
    )!;
    setSelectedFilter(newFilter);

    if (value !== 'custom') {
      const newRange = newFilter.getDateRange();
      setCustomDateRange(newRange);
      console.log('📅 Filter changed to:', value, newRange);
    }
  };

  const handleApply = () => {
    const dateRange = selectedFilter.value === 'custom'
      ? customDateRange
      : selectedFilter.getDateRange();

    console.log('📅 Applying date range:', dateRange);
    setCustomDateRange(dateRange); // Update the display
    setFilter(dateRange);
    toggleActive();
  };

  const handleClear = () => {
    const defaultFilter = filterOptions.last30;
    const defaultRange = defaultFilter.getDateRange();

    setSelectedFilter(defaultFilter);
    setCustomDateRange(defaultRange);
    setFilter(defaultRange);
    toggleActive();
  };

  // Get display text for the button
  const getDisplayText = () => {
    return `From ${formatDateForDisplay(customDateRange.startDate)} to ${formatDateForDisplay(customDateRange.endDate)}`;
  };

  const activator = (
    <Button onClick={toggleActive} icon={CalendarIcon}>
      {getDisplayText()}
    </Button>
  );

  return (
    <Popover
      active={active}
      activator={activator}
      onClose={toggleActive}
      ariaHaspopup={false}
      sectioned
    >
      <Box padding="100">
        {FILTERS_LABELS.map(({ value, label }) => (
          <Box paddingBlockEnd="200" key={value}>
            <RadioButton
              label={label}
              checked={selectedFilter.value === value}
              value={value}
              onChange={() => handleRadioChange(value)}
            />
          </Box>
        ))}

        {selectedFilter && selectedFilter.value === FILTERS.CUSTOM && (
          <>
            <Box paddingBlockEnd="200">
              <Text as="h3" variant="headingSm">Starting</Text>
              <TextField
                label=""
                type="date"
                labelHidden={true}
                value={customDateRange.startDate}
                onChange={(value) => setCustomDateRange(prev => ({
                  ...prev,
                  startDate: value
                }))}
                autoComplete="off"
              />
            </Box>

            <Box paddingBlockEnd="200">
              <Text as="h3" variant="headingSm">Ending</Text>
              <TextField
                label=""
                type="date"
                labelHidden={true}
                value={customDateRange.endDate}
                onChange={(value) => setCustomDateRange(prev => ({
                  ...prev,
                  endDate: value
                }))}
                autoComplete="off"
                min={customDateRange.startDate}
              />
            </Box>
          </>
        )}

        <Box paddingBlockStart="400">
          <ButtonGroup fullWidth>
            <Button onClick={handleClear}>Clear</Button>
            <Button variant="primary" onClick={handleApply}>Apply</Button>
          </ButtonGroup>
        </Box>
      </Box>
    </Popover>
  );
}
