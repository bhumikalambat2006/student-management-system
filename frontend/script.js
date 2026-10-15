
const API_URL = "http://localhost:5000/api/students";

let students = [];

const form = document.getElementById("studentForm");
const table = document.getElementById("studentTable");

async function loadStudents() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Unable to load students");
    }

    students = await response.json();
    searchStudents();
  } catch (error) {
    alert("Cannot connect to backend: " + error.message);
  }
}

function showStudents(list) {
  table.innerHTML = "";

  list.forEach(student => {
    const row = document.createElement("tr");

    [
      student.studentId,
      student.name,
      student.email,
      student.department,
      student.semester,
      student.contact || ""
    ].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const actions = document.createElement("td");

    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.onclick = () => editStudent(student._id);

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-btn";
    deleteButton.onclick = () => deleteStudent(student._id);

    actions.append(editButton, deleteButton);
    row.appendChild(actions);
    table.appendChild(row);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const mongoId = document.getElementById("mongoId").value;

  const student = {
    studentId: document.getElementById("studentId").value,
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    department: document.getElementById("department").value,
    semester: Number(document.getElementById("semester").value),
    contact: document.getElementById("contact").value
  };

  try {
    const response = await fetch(
      mongoId ? `${API_URL}/${mongoId}` : API_URL,
      {
        method: mongoId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(student)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Request failed");
    }

    alert(result.message);
    resetForm();
    await loadStudents();
  } catch (error) {
    alert(error.message);
  }
});

function editStudent(id) {
  const student = students.find(s => s._id === id);

  if (!student) return;

  document.getElementById("mongoId").value = student._id;
  document.getElementById("studentId").value = student.studentId;
  document.getElementById("name").value = student.name;
  document.getElementById("email").value = student.email;
  document.getElementById("department").value = student.department;
  document.getElementById("semester").value = student.semester;
  document.getElementById("contact").value = student.contact || "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteStudent(id) {
  if (!confirm("Are you sure you want to delete this student?")) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Delete failed");
    }

    alert(result.message);
    await loadStudents();
  } catch (error) {
    alert(error.message);
  }
}

function searchStudents() {
  const query = document.getElementById("search")
    .value.toLowerCase();

  const filtered = students.filter(student =>
    student.name.toLowerCase().includes(query) ||
    student.studentId.toLowerCase().includes(query)
  );

  showStudents(filtered);
}

function resetForm() {
  form.reset();
  document.getElementById("mongoId").value = "";
}

loadStudents();
