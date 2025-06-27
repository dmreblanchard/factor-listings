import React, { useState, useEffect } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import EditIcon from "@mui/icons-material/Edit";
import FilterListIcon from '@mui/icons-material/FilterList';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';

const FormatSelectionModal = ({ column, onFormatChange, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState(column.formatOption || "");

  return (
    <Dialog open={true} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <SettingsOutlinedIcon color="primary" />
          {column.label} Format
        </Box>
      </DialogTitle>
      <DialogContent>
        {column.formatOptions ? (
          <List>
            {column.formatOptions.map((format) => (
              <ListItem
                key={format}
                button
                onClick={() => {
                  setSelectedFormat(format);
                  onFormatChange(column.field, format);
                  onClose();
                }}
                selected={selectedFormat === format}
                sx={{
                  borderRadius: 1,
                  "&.Mui-selected": { backgroundColor: "primary.light", color: "primary.dark" },
                }}
              >
                <ListItemText primary={format} />
              </ListItem>
            ))}
          </List>
        ) : (
          <Box textAlign="center" p={2} color="gray">
            No format options available.
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="gray">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ColumnItem = ({ column, index, onRename, onHideToggle, openFormatModal, onMaskToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.field,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    flexDirection: "column", // Stack field name and its subheader vertically
    padding: "10px",
    borderBottom: "1px solid #ddd",
    backgroundColor: "#fff",
    borderRadius: "8px",
  };

  // State to handle inline editing of the field name
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(column.label);

  const handleNameSubmit = () => {
    onRename(index, newName);
    setIsEditingName(false);
  };

  return (
    <Box ref={setNodeRef} style={style} {...attributes}>
      <Box display="flex" alignItems="center">
        {/* Drag handle */}
        <IconButton {...listeners} sx={{ cursor: "grab", touchAction: 'none' }}>
          <DragIndicatorIcon />
        </IconButton>

        {/* Field name and format subheader */}
        {isEditingName ? (
          <TextField
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit();
            }}
            size="small"
            variant="standard"
            sx={{ flex: 1 }}
          />
        ) : (
          <ListItemText
            primary={column.label}
            secondary={column.formatOption ? `Format: ${column.formatOption}` : ""}
            sx={{ flex: 1 }}
          />
        )}

        {column.field === "closeDate" && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onMaskToggle(index);
            }}
            sx={{
              color: column.maskUnderContract ? 'primary.main' : 'inherit',
              mr: 1
            }}
          >
            {column.maskUnderContract ? (
              <FilterAltOffOutlinedIcon /> // Show "off" icon when active
            ) : (
              <FilterAltOutlinedIcon />    // Show regular icon when inactive
            )}
          </IconButton>
        )}

        {/* Gear icon to change format (if applicable) */}
        {column.formatOptions && column.formatOptions.length > 0 && (
          <IconButton onClick={() => openFormatModal(column)}>
            <SettingsOutlinedIcon color="primary" />
          </IconButton>
        )}

        {/* Pencil icon for renaming */}
        <IconButton onClick={() => setIsEditingName(true)}>
          <EditIcon fontSize="small" />
        </IconButton>

        {/* Visibility Toggle */}
        <IconButton onClick={() => onHideToggle(index)}>
          {column.hidden ? (
            <VisibilityOffOutlinedIcon color="disabled" />
          ) : (
            <VisibilityOutlinedIcon color="primary" />
          )}
        </IconButton>
      </Box>
    </Box>
  );
};

const ColumnSettingsModal = ({ open, onClose, allColumns, currentSettings, onSave }) => {
  const [localCols, setLocalCols] = useState([]);
  const [selectedFormatColumn, setSelectedFormatColumn] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  // Initialize with current settings
  useEffect(() => {
    if (open && allColumns) {
      console.log('Initializing modal with:', {
        allColumns,
        currentSettings
      });

      // Step 1: Build base columns with any saved customizations
      const baseCols = allColumns
        .filter(col => col && !col.hideInSettings)
        .map(col => {
          const settings = currentSettings[col.field] || {};
          return {
            ...col,
            ...settings,
            hidden: settings.hidden ?? false,
            label: settings.label || col.headerName || col.label || col.field
          };
        });

      // Step 2: Sort by saved order if it exists
      const orderedFields = currentSettings.__columnOrder;
      const sortedCols = orderedFields
        ? orderedFields
            .map(field => baseCols.find(col => col.field === field))
            .filter(Boolean)
        : baseCols;

      console.log('Processed & sorted columns:', sortedCols);
      setLocalCols(sortedCols);
      setHasChanges(false);
    } else {
      setLocalCols([]);
    }
  }, [open, allColumns, currentSettings]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setLocalCols(prev => {
        const oldIndex = prev.findIndex(c => c.field === active.id);
        const newIndex = prev.findIndex(c => c.field === over?.id);
        const updated = arrayMove(prev, oldIndex, newIndex);
        setHasChanges(true);
        return updated;
      });
    }
  };

  const handleHideToggle = (idx) => {
    setLocalCols(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        hidden: !updated[idx].hidden
      };
      setHasChanges(true);
      return updated;
    });
  };

  const handleRename = (idx, newName) => {
    setLocalCols(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], label: newName };
      setHasChanges(true);
      return updated;
    });
  };

  const handleClose = () => {
    if (hasChanges) {
      const updatedSettings = {};
      const columnOrder = localCols.map(col => col.field);

      localCols.forEach((col) => {
        updatedSettings[col.field] = {
          ...currentSettings[col.field],
          hidden: col.hidden,
          label: col.label,
          formatOption: col.formatOption,
        };
      });

      const finalSettings = {
        ...currentSettings,
        ...updatedSettings,
        __columnOrder: columnOrder
      };

      onSave(finalSettings);
    }
    onClose();
  };



  const handleMaskToggle = (index) => {
    setLocalCols(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        maskUnderContract: !updated[index].maskUnderContract
      };
      setHasChanges(true);
      return updated;
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <ViewColumnOutlinedIcon color="primary" />
              <Typography variant="h6" fontWeight="bold" component="div">
                Customize Columns
              </Typography>
          </Box>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localCols.map(c => c.field)} strategy={verticalListSortingStrategy}>
            {localCols.map((col, i) => (
              <Box key={col.field} sx={{ mb: 1 }}>
                <ColumnItem
                  column={col}
                  index={i}
                  onRename={handleRename}
                  onHideToggle={handleHideToggle}
                  openFormatModal={setSelectedFormatColumn}
                  onMaskToggle={handleMaskToggle}
                />
              </Box>
            ))}
          </SortableContext>
        </DndContext>
      </DialogContent>

      {selectedFormatColumn && (
        <FormatSelectionModal
          column={selectedFormatColumn}
          onFormatChange={(field, format) => {
            setLocalCols(prev => prev.map(col =>
              col.field === field ? { ...col, formatOption: format } : col
            ));
            setHasChanges(true);
          }}
          onClose={() => setSelectedFormatColumn(null)}
        />
      )}
    </Dialog>
  );
};

export default ColumnSettingsModal;
