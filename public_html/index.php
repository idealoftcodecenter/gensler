<?php
session_start();

// Load credentials from private folder
$creds = require "../../private_config/creds.php";

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
<html>

<head>
	<title>Login</title>
</head>

<body>

	<h2>Login</h2>

	<?php if ($error): ?>
		<p style="color:red;"><?php echo $error; ?></p>
	<?php endif; ?>

	<form method="POST">
		<label>Username:</label><br>
		<input type="text" name="username" required><br><br>

		<label>Password:</label><br>
		<input type="password" name="password" required><br><br>

		<button type="submit">Login</button>
	</form>

</body>

</html>