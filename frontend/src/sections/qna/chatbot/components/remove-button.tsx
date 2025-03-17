import {
  Button,
} from '@mui/material';
import { styled } from '@mui/material/styles';


const RemoveButton = styled(Button)(({ theme }) => ({
    minWidth: 'unset',
    padding: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    display: 'flex',
    alignItems: 'center',
    transition: theme.transitions.create(['background-color', 'padding', 'color'], {
      duration: theme.transitions.duration.shorter,
    }),
    '& .iconify': {
      transition: theme.transitions.create('color', {
        duration: theme.transitions.duration.shorter,
      }),
      color: theme.palette.text.secondary,
    },
    '& .removeText': {
      maxWidth: 0,
      overflow: 'hidden',
      opacity: 0,
      transition: theme.transitions.create(['max-width', 'opacity', 'margin'], {
        duration: theme.transitions.duration.shorter,
      }),
      whiteSpace: 'nowrap',
    },
    '&:hover': {
      backgroundColor: theme.palette.error.lighter,
      paddingRight: theme.spacing(1.5),
      color: theme.palette.error.main,
      '& .iconify': {
        color: theme.palette.error.main,
      },
      '& .removeText': {
        maxWidth: '100px',
        opacity: 1,
        marginLeft: theme.spacing(1),
      },
    },
  }));

  export default RemoveButton;