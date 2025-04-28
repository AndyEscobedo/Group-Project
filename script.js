document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Stop form from actually submitting

    let username = document.getElementById('username').value;
    let password = document.getElementById('password').value;

    // Hardcoded check
    if (username === "admin" && password === "password123") {
        alert("Login successful!");

        // VULNERABLE: Directly inserting unsanitized input into innerHTML
        document.body.innerHTML += "<h3>Welcome, " + username + "!</h3>";
    } else {
        alert("Login failed!");
    }
});
