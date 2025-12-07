<?php
session_start();

// Load credentials from private folder
$creds = require "../creds.php";

$USERNAME = $creds['username'];
$PASSWORD_HASH = $creds['password_hash'];


// If logged in, redirect to home
if (!empty($_SESSION['logged_in'])) {
	header("Location: home.php");
	exit;
}

$error = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {
	$user = $_POST['username'] ?? '';
	$pass = $_POST['password'] ?? '';

	if ($user === $USERNAME && password_verify($pass, $PASSWORD_HASH)) {
		$_SESSION['logged_in'] = true;
		header("Location: home.php");
		exit;
	} else {
		$error = "Invalid username or password!";
	}
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
	<!-- Basic -->
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Amazon Virtual Tour</title>
	
	<!-- Favicon -->
	<link rel="icon" type="image/png" href="">
	<link rel="apple-touch-icon" href="">

	<!-- CSS -->
	<link rel="stylesheet" href="assets/css/main.css">

	<!-- Preload Fonts (optional but recommended) -->
	<link rel="preload" href="assets/fonts/EmberModernDisplayStd-Regular.woff2" as="font" type="font/woff" crossorigin>
	<link rel="preload" href="assets/fonts/EmberModernDisplayStd-Bold.woff2" as="font" type="font/woff" crossorigin>

	<!-- Other meta (optional) -->
	<meta name="theme-color" content="">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body>


	<div style="
			/* Flexbox display */
			display: -webkit-box;               /* OLD iOS Safari, OLD Android */
			display: -ms-flexbox;               /* IE 10 */
			display: flex;                      /* Modern browsers */

			/* Align items vertically */
			-webkit-box-align: center;          /* Old Safari/Android */
				-ms-flex-align: center;         /* IE 10 */
					align-items: center;        /* Modern */

			/* Justify content horizontally */
			-webkit-box-pack: center;           /* Old Safari/Android */
				-ms-flex-pack: center;          /* IE 10 */
					justify-content: center;    /* Modern */

			/* Size utilities */
			height: 100%;
			min-height: 100vh;
		">
		<form method="POST" class="login">
			<div class="text-center">
				<img src="assets/img/cont/amazon-symbol.svg" alt="Logo" style="height: 18px; width: auto;">
				<h3 class="font-normal text-center mt-4">Login</h3>
			</div>

			<div class="form-row mt-4">
				<label>Username:</label>
				<input type="text" name="username" required>
			</div>
			<div class="form-row">
				<label>Password:</label>
				<input type="password" name="password" required>
			</div>

			<?php if ($error): ?>
				<p style="color:red;"><?php echo $error; ?></p>
			<?php endif; ?>
	
			<button class="login-btn" type="submit">Login</button>
		</form>
	</div>

</body>
</html>