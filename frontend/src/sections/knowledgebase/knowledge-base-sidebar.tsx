import type { Icon as IconifyIcon } from '@iconify/react';

import { Icon } from '@iconify/react';
import tagIcon from '@iconify-icons/mdi/tag';
import closeIcon from '@iconify-icons/mdi/close';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import upIcon from '@iconify-icons/mdi/chevron-up';
import leftIcon from '@iconify-icons/mdi/chevron-left';
import downIcon from '@iconify-icons/mdi/chevron-down';
import rightIcon from '@iconify-icons/mdi/chevron-right';
import { useLocation, useNavigate } from 'react-router-dom';
import viewModuleIcon from '@iconify-icons/mdi/view-module';
import filterMenuIcon from '@iconify-icons/mdi/filter-menu';
import filterRemoveIcon from '@iconify-icons/mdi/filter-remove';
import filterVariantIcon from '@iconify-icons/mdi/filter-variant';
import circleOutlineIcon from '@iconify-icons/mdi/circle-outline';
import progressClockIcon from '@iconify-icons/mdi/progress-clock';
import officeBuildingIcon from '@iconify-icons/mdi/office-building';
import formatListIcon from '@iconify-icons/mdi/format-list-bulleted';
import closeCircleIcon from '@iconify-icons/mdi/close-circle-outline';
import alertCircleOutlineIcon from '@iconify-icons/mdi/alert-circle-outline';
import checkCircleOutlineIcon from '@iconify-icons/mdi/check-circle-outline';

import { alpha, styled, useTheme, keyframes } from '@mui/material/styles';
import {
  Box,
  Chip,
  Badge,
  Paper,
  Drawer,
  Button,
  Tooltip,
  Checkbox,
  Collapse,
  FormGroup,
  Typography,
  IconButton,
  FormControlLabel,
  CircularProgress,
  Fade,
} from '@mui/material';

import type { Modules } from './types/modules';
import type { Departments } from './types/departments';
import type { SearchTagsRecords } from './types/search-tags';
import type { RecordCategories } from './types/record-categories';
import type {
  Filters,
  FilterHeaderProps,
  KnowledgeBaseSideBarProps,
  FilterSectionComponentProps,
} from './types/knowledge-base';

// Constants
const DRAWER_EXPANDED_WIDTH = 320;
const DRAWER_COLLAPSED_WIDTH = 64;

// Define a subtle pulse animation
const pulse = keyframes`
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0.6;
  }
`;

// Custom styled components with optimized transitions
const OpenedDrawer = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: open ? DRAWER_EXPANDED_WIDTH : DRAWER_COLLAPSED_WIDTH,
    flexShrink: 0,
    marginTop: 50,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    // Use will-change for better GPU optimization
    willChange: 'width',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: '0.25s',
    }),
    '& .MuiDrawer-paper': {
      marginTop: 64,
      width: open ? DRAWER_EXPANDED_WIDTH : DRAWER_COLLAPSED_WIDTH,
      transition: theme.transitions.create(['width'], {
        easing: theme.transitions.easing.sharp,
        duration: '0.25s',
      }),
      overflowX: 'hidden',
      borderRight: 'none',
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[2],
    },
  })
);

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 2.5),
  ...theme.mixins.toolbar,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  position: 'relative', // For the loading indicator
}));

const FilterSection = styled('div')(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(1),
  overflow: 'hidden',
}));

// Updated to accept the expanded prop properly with a type
const FilterHeader = styled('div', {
  shouldForwardProp: (prop) => prop !== 'expanded',
})<FilterHeaderProps>(({ theme, expanded }) => ({
  padding: theme.spacing(1.5, 2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: expanded ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

const FilterContent = styled(Collapse)(({ theme }) => ({
  padding: theme.spacing(0.5, 2, 1.5, 2),
  maxHeight: 260,
  overflow: 'auto',
  '&::-webkit-scrollbar': {
    width: '4px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(theme.palette.text.secondary, 0.2),
    borderRadius: '4px',
  },
  transition: theme.transitions.create(['height'], {
    duration: '0.2s',
    easing: theme.transitions.easing.sharp,
  }),
}));

const FilterLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  color: theme.palette.text.primary,
}));

const FilterCheckbox = styled(Checkbox)(({ theme }) => ({
  padding: theme.spacing(0.5),
  '&.Mui-checked': {
    color: theme.palette.primary.main,
  },
}));

const FilterCount = styled(Badge)(({ theme }) => ({
  '& .MuiBadge-badge': {
    right: -12,
    top: 2,
    fontSize: '0.7rem',
    height: 18,
    minWidth: 18,
    border: `2px solid ${theme.palette.background.paper}`,
    padding: '0 4px',
  },
}));

const FiltersContainer = styled(Box)(({ theme }) => ({
  height: 'calc(100vh - 110px)',
  overflow: 'auto',
  padding: theme.spacing(2, 1.5),
  '&::-webkit-scrollbar': {
    width: '4px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(theme.palette.text.secondary, 0.15),
    borderRadius: '10px',
  },
  transition: theme.transitions.create('opacity', {
    duration: '0.2s',
    easing: theme.transitions.easing.sharp,
  }),
}));

const FilterChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  borderRadius: '6px',
  height: 28,
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  color: theme.palette.primary.dark,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
  transition: theme.transitions.create('background-color', {
    duration: '0.1s',
    easing: theme.transitions.easing.sharp,
  }),
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
  },
  '& .MuiChip-deleteIcon': {
    color: theme.palette.primary.main,
    width: 16,
    height: 16,
  },
}));

const ActiveFiltersContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  marginBottom: theme.spacing(2.5),
  display: 'flex',
  flexWrap: 'wrap',
  backgroundColor: alpha(theme.palette.background.default, 0.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  position: 'relative', // For the loading overlay
}));

const ClearFiltersButton = styled(Button)(({ theme }) => ({
  minWidth: 'auto',
  padding: theme.spacing(0.5, 1),
  fontSize: '0.75rem',
  textTransform: 'none',
  color: theme.palette.primary.main,
  fontWeight: 500,
  transition: theme.transitions.create('background-color', {
    duration: '0.1s',
    easing: theme.transitions.easing.sharp,
  }),
}));

const FormControlLabelStyled = styled(FormControlLabel)(({ theme }) => ({
  marginBottom: 4,
  marginLeft: -8,
  '& .MuiTypography-root': {
    fontSize: '0.85rem',
    fontWeight: 400,
  },
  opacity: 1,
  '&:hover': {
    opacity: 0.9,
  },
}));

const CollapsedButtonContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'visible',
})<{ visible: boolean }>(({ theme, visible }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: theme.spacing(2),
  opacity: visible ? 1 : 0,
  transition: theme.transitions.create('opacity', {
    duration: '0.2s',
    easing: theme.transitions.easing.sharp,
    delay: visible ? '0.05s' : '0s',
  }),
}));

const ExpandedContentContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'visible',
})<{ visible: boolean }>(({ theme, visible }) => ({
  opacity: visible ? 1 : 0,
  transition: theme.transitions.create('opacity', {
    duration: '0.2s',
    easing: theme.transitions.easing.sharp,
    delay: visible ? '0.05s' : '0s',
  }),
  width: '100%',
  position: 'relative',
}));

const IconButtonStyled = styled(IconButton)(({ theme }) => ({
  transition: theme.transitions.create('background-color', {
    duration: '0.1s',
    easing: theme.transitions.easing.sharp,
  }),
  '&:hover': {
    transform: 'scale(1.05)',
  },
  '&:active': {
    transform: 'scale(0.95)',
  },
}));

// Clean, minimalist loading indicator that appears in the top-right corner
const LoadingIndicator = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 10,
  right: 10,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  padding: 2,
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  boxShadow: theme.shadows[1],
}));

// A clean status indicator that shows without disrupting the UI
const StatusIndicator = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ theme, active }) => ({
  position: 'absolute',
  bottom: -3,
  left: 0,
  right: 0,
  height: 3,
  backgroundColor: theme.palette.primary.main,
  opacity: active ? 1 : 0,
  animation: active ? `${pulse} 1.5s infinite ease-in-out` : 'none',
  transition: theme.transitions.create(['opacity'], {
    duration: '0.2s',
    easing: theme.transitions.easing.sharp,
  }),
}));

// Status icons mapping
const statusIcons: Record<string, React.ComponentProps<typeof IconifyIcon>['icon']> = {
  NOT_STARTED: circleOutlineIcon,
  IN_PROGRESS: progressClockIcon,
  FAILED: alertCircleOutlineIcon,
  COMPLETED: checkCircleOutlineIcon,
};

// Helper function to format labels
const formatLabel = (label: string): string => {
  if (!label) return '';
  return label
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
};

export default function KnowledgeBaseSideBar({
  filters,
  onFilterChange,
  openSidebar = true,
  onToggleSidebar,
  sx = {},
}: KnowledgeBaseSideBarProps) {
  const theme = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(true);
  const [departments, setDepartments] = useState<Departments[]>([]);
  const [recordCategories, setRecordCategories] = useState<RecordCategories[]>([]);
  const [modules, setModules] = useState<Modules[]>([]);
  const [tags, setTags] = useState<SearchTagsRecords[]>([]);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    status: true,
  });

  // Add a ref to track if filter operation is in progress
  const isFilterChanging = useRef(false);
  // Add a loading state for filter changes
  const [isLoading, setIsLoading] = useState(false);
  // Keep local copy of filters to prevent UI flicker during updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Store previous filters for comparison
  const prevFiltersRef = useRef<Filters | null>(null);

  // Smoothly manage content appearance
  const [showCollapsedContent, setShowCollapsedContent] = useState(!openSidebar);
  const [showExpandedContent, setShowExpandedContent] = useState(openSidebar);

  // Status color mapping using theme colors
  const statusColors: Record<string, string> = {
    NOT_STARTED: theme.palette.grey[500],
    IN_PROGRESS: theme.palette.info.main,
    FAILED: theme.palette.error.main,
    COMPLETED: theme.palette.success.main,
  };

  // Use memo to cache active filter counts
  const activeCounts = useMemo(() => {
    const counts: Record<keyof Filters, number> = {
      indexingStatus: 0,
      department: 0,
      moduleId: 0,
      searchTags: 0,
      appSpecificRecordType: 0,
      recordType: 0,
      origin: 0,
      status: 0,
      connector: 0,
      app: 0,
    };

    // Calculate counts from local filters to prevent UI flicker
    Object.entries(localFilters).forEach(([key, values]) => {
      counts[key as keyof Filters] = Array.isArray(values) ? values.length : 0;
    });

    return counts;
  }, [localFilters]);

  // Use memo to cache total active filter count
  const totalActiveFilterCount = useMemo(
    () => Object.values(activeCounts).reduce((acc, count) => acc + count, 0),
    [activeCounts]
  );

  // Update local filters when props change, with added stability mechanism
  useEffect(() => {
    // Compare with prev filters to avoid unnecessary updates
    if (
      !prevFiltersRef.current ||
      JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)
    ) {
      // Only update if there's a real change
      setLocalFilters(filters);
      prevFiltersRef.current = filters;
    }
  }, [filters]);

  // Sync internal state with prop
  useEffect(() => {
    setOpen(openSidebar);

    // Manage content visibility with a slight delay for smooth transitions
    if (openSidebar) {
      setShowCollapsedContent(false);
      // Shorter delay
      setTimeout(() => setShowExpandedContent(true), 100);
    } else {
      setShowExpandedContent(false);
      // Shorter delay
      setTimeout(() => setShowCollapsedContent(true), 100);
    }
  }, [openSidebar]);

  const handleDrawerToggle = () => {
    const newOpenState = !open;
    setOpen(newOpenState);

    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };

  const handleFilterChange = (filterType: keyof Filters, value: string) => {
    // If a filter operation is already in progress, return to prevent flickering
    if (isFilterChanging.current) return;

    // Set the flag to indicate a filter operation is in progress
    isFilterChanging.current = true;
    // Show loading indicator
    setIsLoading(true);

    // Update the local state first for immediate feedback
    const currentFilterValues = localFilters[filterType] || [];
    const newValues = currentFilterValues.includes(value)
      ? currentFilterValues.filter((item: string) => item !== value)
      : [...currentFilterValues, value];

    setLocalFilters((prev) => ({
      ...prev,
      [filterType]: newValues,
    }));

    // Use requestAnimationFrame to batch UI updates
    requestAnimationFrame(() => {
      // Create updated filters for parent component
      const updatedFilters = {
        ...filters,
        [filterType]: currentFilterValues.includes(value)
          ? currentFilterValues.filter((item: string) => item !== value)
          : [...currentFilterValues, value],
      };

      // Update parent without causing a re-render of this component
      onFilterChange(updatedFilters);

      // Reset the flag and loading state after a short delay
      setTimeout(() => {
        isFilterChanging.current = false;
        setIsLoading(false);
      }, 300); // A slightly longer delay to ensure the parent component has updated
    });
  };

  // Handle click on collapsed filter icon
  const handleCollapsedFilterClick = (sectionId: string, filterType: keyof Filters) => {
    // If drawer is closed, open it
    if (!open) {
      setOpen(true);
      if (onToggleSidebar) {
        onToggleSidebar();
      }

      // Expand the section that was clicked
      setExpandedSections({
        ...expandedSections,
        [sectionId]: true,
      });
    }
  };

  // Get count of active filters - use the cached counts
  const getActiveFilterCount = (filterType: keyof Filters): number => activeCounts[filterType];

  // Get filter item names by IDs
  const getFilterName = (type: keyof Filters, id: string): string => {
    switch (type) {
      case 'department':
        return departments.find((d) => d._id === id)?.name || id;
      case 'moduleId':
        return modules.find((m) => m._id === id)?.name || id;
      case 'searchTags':
        return tags.find((t) => t._id === id)?.name || id;
      case 'appSpecificRecordType':
        return recordCategories.find((c) => c._id === id)?.name || id;
      case 'indexingStatus':
        return formatLabel(id);
      default:
        return id;
    }
  };

  // Clear a specific filter
  const clearFilter = (type: keyof Filters, value: string) => {
    // If a filter operation is already in progress, return
    if (isFilterChanging.current) return;

    isFilterChanging.current = true;
    setIsLoading(true);

    // Update local state first
    setLocalFilters((prev) => ({
      ...prev,
      [type]: (prev[type] || []).filter((item) => item !== value),
    }));

    requestAnimationFrame(() => {
      const updatedFilters = {
        ...filters,
        [type]: (filters[type] || []).filter((item) => item !== value),
      };

      onFilterChange(updatedFilters);

      setTimeout(() => {
        isFilterChanging.current = false;
        setIsLoading(false);
      }, 300);
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    // If a filter operation is already in progress, return
    if (isFilterChanging.current) return;

    isFilterChanging.current = true;
    setIsLoading(true);

    // Update local state immediately
    setLocalFilters({
      indexingStatus: [],
      department: [],
      moduleId: [],
      searchTags: [],
      appSpecificRecordType: [],
    });

    requestAnimationFrame(() => {
      onFilterChange({
        indexingStatus: [],
        department: [],
        moduleId: [],
        searchTags: [],
        appSpecificRecordType: [],
      });

      setTimeout(() => {
        isFilterChanging.current = false;
        setIsLoading(false);
      }, 300);
    });
  };

  // Generate active filters view
  const renderActiveFilters = () => {
    if (totalActiveFilterCount === 0) return null;

    return (
      <ActiveFiltersContainer elevation={0}>
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            mb: 1.5,
            alignItems: 'center',
          }}
        >
          <Typography variant="body2" fontWeight={600} color="primary" sx={{ fontSize: '0.85rem' }}>
            Active Filters ({totalActiveFilterCount})
          </Typography>
          <ClearFiltersButton
            variant="text"
            size="small"
            onClick={clearAllFilters}
            disableRipple
            startIcon={<Icon icon={closeCircleIcon} fontSize="small" />}
          >
            Clear All
          </ClearFiltersButton>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          {Object.entries(localFilters).map(([type, values]) =>
            (values || []).map((value: any) => (
              <FilterChip
                key={`${type}-${value}`}
                label={getFilterName(type as keyof Filters, value)}
                size="small"
                onDelete={() => clearFilter(type as keyof Filters, value)}
                deleteIcon={<Icon icon={closeIcon} fontSize="small" />}
              />
            ))
          )}
        </Box>
      </ActiveFiltersContainer>
    );
  };

  // Collapsed sidebar content with memoization
  const CollapsedContent = useMemo(
    () => (
      <CollapsedButtonContainer visible={showCollapsedContent}>
        <Tooltip title="Status Filters" placement="right">
          <IconButtonStyled
            color="primary"
            sx={{ mb: 2 }}
            onClick={() => handleCollapsedFilterClick('status', 'indexingStatus')}
            disableRipple
          >
            <Badge badgeContent={activeCounts.indexingStatus} color="primary">
              <Icon icon={filterVariantIcon} />
            </Badge>
          </IconButtonStyled>
        </Tooltip>
        <Tooltip title="Department Filters" placement="right">
          <IconButtonStyled
            color="primary"
            sx={{ mb: 2 }}
            onClick={() => handleCollapsedFilterClick('departments', 'department')}
            disableRipple
          >
            <Badge badgeContent={activeCounts.department} color="primary">
              <Icon icon={officeBuildingIcon} />
            </Badge>
          </IconButtonStyled>
        </Tooltip>
        <Tooltip title="Module Filters" placement="right">
          <IconButtonStyled
            color="primary"
            sx={{ mb: 2 }}
            onClick={() => handleCollapsedFilterClick('modules', 'moduleId')}
            disableRipple
          >
            <Badge badgeContent={activeCounts.moduleId} color="primary">
              <Icon icon={viewModuleIcon} />
            </Badge>
          </IconButtonStyled>
        </Tooltip>
        <Tooltip title="Tag Filters" placement="right">
          <IconButtonStyled
            color="primary"
            sx={{ mb: 2 }}
            onClick={() => handleCollapsedFilterClick('tags', 'searchTags')}
            disableRipple
          >
            <Badge badgeContent={activeCounts.searchTags} color="primary">
              <Icon icon={tagIcon} />
            </Badge>
          </IconButtonStyled>
        </Tooltip>
        <Tooltip title="Category Filters" placement="right">
          <IconButtonStyled
            color="primary"
            sx={{ mb: 2 }}
            onClick={() => handleCollapsedFilterClick('categories', 'appSpecificRecordType')}
            disableRipple
          >
            <Badge badgeContent={activeCounts.appSpecificRecordType} color="primary">
              <Icon icon={formatListIcon} />
            </Badge>
          </IconButtonStyled>
        </Tooltip>

        {totalActiveFilterCount > 0 && (
          <Tooltip title="Clear All Filters" placement="right">
            <IconButtonStyled
              color="error"
              onClick={clearAllFilters}
              disableRipple
              sx={{
                mt: 2,
                bgcolor: alpha(theme.palette.error.main, 0.1),
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.2),
                },
              }}
            >
              <Icon icon={filterRemoveIcon} />
            </IconButtonStyled>
          </Tooltip>
        )}
      </CollapsedButtonContainer>
    ),
    // eslint-disable-next-line
    [showCollapsedContent, activeCounts, totalActiveFilterCount]
  );

  // Filter section component - memoize for better performance
  const StatusFilterSection = useMemo(
    () => (
      <FilterSection>
        <FilterHeader
          expanded={expandedSections.status || false}
          onClick={() => toggleSection('status')}
        >
          <FilterLabel>
            <Icon
              icon={filterVariantIcon}
              fontSize="small"
              color={
                expandedSections.status ? theme.palette.primary.main : theme.palette.text.secondary
              }
            />
            Status
            {activeCounts.indexingStatus > 0 && (
              <FilterCount badgeContent={activeCounts.indexingStatus} color="primary" />
            )}
          </FilterLabel>
          <Icon
            icon={expandedSections.status ? upIcon : downIcon}
            fontSize="small"
            color={theme.palette.text.secondary}
          />
        </FilterHeader>
        <FilterContent in={expandedSections.status || false}>
          <FormGroup>
            {['NOT_STARTED', 'IN_PROGRESS', 'FAILED', 'COMPLETED'].map((status) => {
              const isChecked = (localFilters.indexingStatus || []).includes(status);

              return (
                <FormControlLabelStyled
                  key={status}
                  control={
                    <FilterCheckbox
                      checked={isChecked}
                      onClick={() => handleFilterChange('indexingStatus', status)}
                      size="small"
                      disableRipple
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Icon
                        icon={statusIcons[status]}
                        color={statusColors[status]}
                        width={16}
                        height={16}
                      />
                      {formatLabel(status)}
                    </Box>
                  }
                />
              );
            })}
          </FormGroup>
        </FilterContent>
      </FilterSection>
    ),
    // eslint-disable-next-line
    [expandedSections.status, activeCounts.indexingStatus, localFilters.indexingStatus]
  );

  return (
    <OpenedDrawer
      variant="permanent"
      open={open}
      sx={{
        ...sx,
        transition: theme.transitions.create('width', {
          duration: '0.25s',
          easing: theme.transitions.easing.sharp,
        }),
      }}
    >
      <DrawerHeader>
        {open ? (
          <>
            <Typography
              variant="subtitle1"
              fontWeight={600}
              sx={{ color: theme.palette.primary.main }}
            >
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Icon icon={filterMenuIcon} />
                Filters
              </Box>
            </Typography>

            {/* Clean loading indicator in header */}
            <Fade in={isLoading} timeout={150}>
              <LoadingIndicator>
                <CircularProgress size={16} thickness={4} />
              </LoadingIndicator>
            </Fade>

            <Tooltip title="Collapse sidebar">
              <IconButtonStyled
                onClick={handleDrawerToggle}
                size="small"
                disableRipple
                sx={{ color: theme.palette.text.secondary }}
              >
                <Icon icon={leftIcon} width={20} height={20} />
              </IconButtonStyled>
            </Tooltip>

            {/* Status indicator bar at the bottom of header */}
            <StatusIndicator active={isLoading} />
          </>
        ) : (
          <>
            <Tooltip title="Expand sidebar" placement="right">
              <IconButtonStyled
                onClick={handleDrawerToggle}
                disableRipple
                sx={{ mx: 'auto', color: theme.palette.primary.main }}
              >
                <Icon icon={rightIcon} width={20} height={20} />
              </IconButtonStyled>
            </Tooltip>

            {/* Status indicator for collapsed state */}
            <StatusIndicator active={isLoading} />
          </>
        )}
      </DrawerHeader>

      {!open ? (
        CollapsedContent
      ) : (
        <ExpandedContentContainer visible={showExpandedContent}>
          <FiltersContainer>
            {renderActiveFilters()}
            {StatusFilterSection}

            {/* Other filter sections can be added/implemented similarly */}
            {/* <FilterSectionComponent
              id="departments"
              icon={officeBuildingIcon}
              label="Departments"
              filterType="department"
              items={departments}
            /> */}

            {/* <FilterSectionComponent
              id="modules"
              icon={viewModuleIcon}
              label="Modules"
              filterType="moduleId"
              items={modules}
            /> */}

            {/* <FilterSectionComponent
              id="tags"
              icon={tagIcon}
              label="Tags"
              filterType="searchTags"
              items={tags}
            /> */}

            {/* <FilterSectionComponent
              id="categories"
              icon={formatListIcon}
              label="Record Categories"
              filterType="appSpecificRecordType"
              items={recordCategories}
            /> */}
          </FiltersContainer>
        </ExpandedContentContainer>
      )}
    </OpenedDrawer>
  );
}
