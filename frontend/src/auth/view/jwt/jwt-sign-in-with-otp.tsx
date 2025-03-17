// import type { Theme, SxProps } from '@mui/material';

// import { z as zod } from 'zod';
// import { useState } from 'react';
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';

// import Box from '@mui/material/Box';
// import Link from '@mui/material/Link';
// import Alert from '@mui/material/Alert';
// import { CircularProgress } from '@mui/material';
// import IconButton from '@mui/material/IconButton';
// import LoadingButton from '@mui/lab/LoadingButton';
// import InputAdornment from '@mui/material/InputAdornment';

// import { useRouter } from 'src/routes/hooks';

// import { useBoolean } from 'src/hooks/use-boolean';

// import { Iconify } from 'src/components/iconify';
// import { Form, Field } from 'src/components/hook-form';

// import { useAuthContext } from '../../hooks';
// import { getOtp, signInWithOtp } from '../../context/jwt';

// // ----------------------------------------------------------------------

// export const SignInSchema = zod.object({
//   email: zod
//     .string()
//     .min(1, { message: 'Email is required!' })
//     .email({ message: 'Email must be a valid email address!' }),
//   otp: zod
//     .string()
//     .min(6, { message: 'OTP must be 6 digits!' })
//     .max(6, { message: 'OTP must be 6 digits!' }),
// });

// type SignInSchemaType = zod.infer<typeof SignInSchema>;


// interface OtpSignInProps {
//   sx?: SxProps<Theme>;
// }

// // ----------------------------------------------------------------------

// export default function OtpSignIn({sx}:OtpSignInProps) {
//   const router = useRouter();

//   const { checkUserSession } = useAuthContext();

//   const [errorMsg, setErrorMsg] = useState<string>('');

//   const [sendingOtp, setSendingOtp] = useState<boolean>(false);

//   const [successMsg, setSuccessMsg] = useState<string>('');

//   const password = useBoolean();

//   const methods = useForm<SignInSchemaType>({
//     resolver: zodResolver(SignInSchema),
//   });

//   const {
//     handleSubmit,
//     getValues,
//     formState: { isSubmitting },
//   } = methods;

//   const handleGetOtp = async () : Promise<void> => {
//     const email = getValues('email');
//     if (!email) {
//       setErrorMsg('Please enter your email to get the OTP.');
//       return;
//     }
//     setSendingOtp(true);

//     setErrorMsg('');
//     setSuccessMsg('');

//     try {
//       await getOtp({ email });
//       setSuccessMsg('Sent OTP to mail. Please check spam/junk folder if you didn’t get OTP.');
//       setTimeout(() => {
//         setSuccessMsg('');
//       }, 10000);
//     } catch (error) {
//       // setErrorMsg('Failed to send OTP. Please try again');
//       setErrorMsg(typeof error === 'string' ? error : error.errorMessage);
//     } finally {
//       setSendingOtp(false);
//     }
//   };

//   const onSubmit = handleSubmit(async (data : SignInSchemaType) : Promise<void> => {
//     try {
//       console.log(data, 'data');
//       await signInWithOtp({ email: data.email, otp: data.otp });

//       await checkUserSession?.();

//       router.refresh();
//     } catch (error) {
//       console.error(error);
//       setErrorMsg(typeof error === 'string' ? error : error.errorMessage);
//     }
//   });

//   const renderForm = (
//     <Box gap={0.5} display="flex" flexDirection="column">
//       <Field.Text name="email" label="Email address" fullWidth InputLabelProps={{ shrink: true }} />

//       <Box gap={3} display="flex" flexDirection="column">
//         <Link
//           variant="body2"
//           color="inherit"
//           onClick={handleGetOtp}
//           sx={{ alignSelf: 'flex-end', cursor: 'pointer' }}
//         >
//           {sendingOtp ? (
//             <CircularProgress size={20} sx={{ marginRight: 5 }} />
//           ) : (
//             'Send OTP to email'
//           )}
//         </Link>

//         <Field.Text
//           name="otp"
//           label="OTP"
//           fullWidth
//           placeholder="Enter 6-digit OTP"
//           inputMode="numeric"
//           type={password.value ? 'text' : 'password'}
//           InputLabelProps={{ shrink: true }}
//           InputProps={{
//             endAdornment: (
//               <InputAdornment position="end">
//                 <IconButton onClick={password.onToggle} edge="end">
//                   <Iconify icon={password.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
//                 </IconButton>
//               </InputAdornment>
//             ),
//           }}
//         />
//       </Box>

//       {!!successMsg && (
//         <Alert severity="success" sx={{ mt: 3 }}>
//           {successMsg}
//         </Alert>
//       )}

//       <LoadingButton
//         fullWidth
//         color="inherit"
//         size="large"
//         type="submit"
//         variant="contained"
//         loading={isSubmitting}
//         loadingIndicator="Sign in..."
//         sx={{ mt: 4 }}
//       >
//         Sign in
//       </LoadingButton>
//     </Box>
//   );

//   return (
//     <>
//       {!!errorMsg && (
//         <Alert severity="error" sx={{ mb: 3 }}>
//           {errorMsg}
//         </Alert>
//       )}

//       <Form methods={methods} onSubmit={onSubmit}>
//         {renderForm}
//       </Form>
//     </>
//   );
// }
