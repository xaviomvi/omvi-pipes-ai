import { Icon } from '@iconify/react';
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { styled } from '@mui/material/styles';
import {
  Box,
  List,
  Drawer,
  Checkbox,
  Accordion,
  FormGroup,
  Typography,
  IconButton,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
} from '@mui/material';

import { fetchTags, fetchModules, fetchDepartments, fetchRecordCategories } from './utils';

import type { Modules } from './types/modules';
import type { Departments } from './types/departments';
import type { SearchTagsRecords } from './types/search-tags';
import type { RecordCategories } from './types/record-categories';
import type { Filters, KnowledgeSearchSideBarProps } from './types/knowledge-base';

const drawerWidth = 320;
const closedDrawerWidth = 50;

const OpenedDrawer = styled(Drawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: open ? drawerWidth : closedDrawerWidth,
    flexShrink: 0,
    marginTop: 40,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    '& .MuiDrawer-paper': {
      marginTop: 52,
      width: open ? drawerWidth : closedDrawerWidth,
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
      overflowX: 'hidden',
    },
  })
);

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

export default function KnowledgeSearchSideBar({ filters, onFilterChange } : KnowledgeSearchSideBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(true);
  const [departments, setDepartments] = useState<Departments[]>([]);
  const [recordCategories, setRecordCategories] = useState<RecordCategories[]>([]);
  const [modules, setModules] = useState<Modules[]>([]);
  const [tags, setTags] = useState<SearchTagsRecords[]>([]);
  // const [selectedStatus, setSelectedStatus] = useState([]);
  // const [selectedDepartments, setSelectedDepartments] = useState([]);
  // const [selectedCategories, setSelectedCategories] = useState([]);
  // const [selectedModules, setSelectedModules] = useState([]);
  // const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptData, catData, tagData, moduleData] = await Promise.all([
          fetchDepartments(),
          fetchRecordCategories(),
          fetchTags(),
          fetchModules(),
        ]);
        setDepartments(deptData);
        setRecordCategories(catData);
        setTags(tagData);
        setModules(moduleData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, []);

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const handleFilterChange = (
    filterType: keyof Filters,
    value: string
  ) => {
    // Safely access the current filter array with a fallback to empty array if undefined
    const currentFilterValues = filters[filterType] || [];

    // Create updated filters
    const updatedFilters = {
      ...filters,
      [filterType]: currentFilterValues.includes(value)
        ? currentFilterValues.filter((item: string) => item !== value)
        : [...currentFilterValues, value],
    };

    onFilterChange(updatedFilters);
  };

  // const handleStatusChange = (status) => {
  //   setSelectedStatus((prev) =>
  //     prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
  //   );
  // };

  // const handleModuleChange = (id) => {
  //   setSelectedModules((prev) =>
  //     prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
  //   );
  // };

  // const handleTagChange = (id) => {
  //   setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  // };

  // const handleDepartmentChange = (id) => {
  //   setSelectedDepartments((prev) =>
  //     prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
  //   );
  // };

  // const handleCategoryChange = (id) => {
  //   setSelectedCategories((prev) =>
  //     prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
  //   );
  // };

  return (
    <OpenedDrawer variant="permanent" open={open}>
      <DrawerHeader>
        <IconButton onClick={handleDrawerToggle}>
          <Icon icon={open ? 'mdi:chevron-left' : 'mdi:chevron-right'} />
        </IconButton>
      </DrawerHeader>

      {open && (
        <>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" color="text.secondary">
              Filters
            </Typography>
          </Box>

          <List sx={{ mb: 6 }}>
            {/* <Accordion>
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
                <Typography>Status</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup>
                  {['PROCESSING', 'PROCESSING_FAILED', 'UNPUBLISHED', 'ARCHIVED', 'EXPIRED'].map(
                    (status) => (
                      <FormControlLabel
                        key={status}
                        control={
                          <Checkbox
                            //   checked={selectedStatus.includes(status)}
                            //   onChange={() => handleFilterChange(status)}
                            checked={filters.status.includes(status)}
                            onChange={() => handleFilterChange('status', status)}
                          />
                        }
                        label={status}
                      />
                    )
                  )}
                </FormGroup>
              </AccordionDetails>
            </Accordion> */}

            <Accordion>
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
                <Typography>Departments</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup>
                  {departments.map((dept) => (
                    <FormControlLabel
                      key={dept._id}
                      control={
                        <Checkbox
                          //   checked={selectedDepartments.includes(dept._id)}
                          //   onChange={() => handleDepartmentChange(dept._id)}
                          checked={filters.department?.includes(dept._id)}
                          onChange={() => handleFilterChange('department', dept._id)}
                        />
                      }
                      label={dept.name}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
                <Typography>Modules</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup>
                  {/* <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedModules.includes('allProducts')}
                        onChange={() => handleModuleChange('allProducts')}
                      />
                    }
                    label="All Products"
                  /> */}
                  {modules.map((module) => (
                    <FormControlLabel
                      key={module._id}
                      control={
                        <Checkbox
                          //   checked={selectedModules.includes(module._id)}
                          //   onChange={() => handleModuleChange(module._id)}
                          checked={filters.moduleId?.includes(module._id)}
                          onChange={() => handleFilterChange('moduleId', module._id)}
                        />
                      }
                      label={module.name}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>

            {/* <Accordion>
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
                <Typography>Tags</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup>
                  {tags.map((tag) => (
                    <FormControlLabel
                      key={tag._id}
                      control={
                        <Checkbox
                          //   checked={selectedTags.includes(tag._id)}
                          //   onChange={() => handleTagChange(tag._id)}
                          checked={filters.tags?.includes(tag._id)}
                          onChange={() => handleFilterChange('searchTags', tag._id)}
                        />
                      }
                      label={tag.name}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion> */}

            <Accordion>
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
                <Typography>Record Categories</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormGroup>
                  {recordCategories.map((category) => (
                    <FormControlLabel
                      key={category._id}
                      control={
                        <Checkbox
                          checked={filters.appSpecificRecordType?.includes(category._id)}
                          onChange={() => handleFilterChange('appSpecificRecordType', category._id)}
                        />
                      }
                      label={category.name}
                    />
                  ))}
                </FormGroup>
              </AccordionDetails>
            </Accordion>
          </List>
        </>
      )}
    </OpenedDrawer>
  );
}
