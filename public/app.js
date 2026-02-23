const submitBtn = document.getElementById("submitBtn");
const resultEl = document.getElementById("result");
const emailEl = document.getElementById("emailInput");
const passcodeEl = document.getElementById("passcodeInput");

async function submit() {
  const passcode = (passcodeEl.value || "").trim();
  const email = (emailEl.value || "").trim();

  resultEl.textContent = "";
  resultEl.style.color = "black";

  if (!passcode) {
    resultEl.textContent = "Please enter the event passcode.";
    resultEl.style.color = "red";
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    resultEl.textContent = "Please enter a valid email address.";
    resultEl.style.color = "red";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Checking…";

  try {
    const resp = await fetch("/api/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Passcode": passcode
      },
      body: JSON.stringify({ email })
    });

    const data = await resp.json().catch(() => null);

    if (!resp.ok) {
      resultEl.textContent = (data && data.message) ? data.message : "Something went wrong.";
      resultEl.style.color = "red";
      return;
    }

    resultEl.textContent = data.message || "Done.";
    resultEl.style.color = data.found ? "green" : "red";
  } catch (e) {
    resultEl.textContent = "Network error. Please try again.";
    resultEl.style.color = "red";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit";
  }
}

submitBtn.addEventListener("click", submit);
emailEl.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
passcodeEl.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });