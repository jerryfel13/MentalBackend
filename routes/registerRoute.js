export async function POST(req) {
  try {
    const body = await req.json();
    const {
      full_name,
      date_of_birth,
      gender,
      civil_status,
      address,
      contact_number,
      email_address,
      emergency_contact_person_number,
      password,
    } = body;

    const bcrypt = require("bcrypt"); // If using JS, import changes
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase.from("patients").insert([
      {
        full_name,
        date_of_birth,
        gender,
        civil_status,
        address,
        contact_number,
        email_address,
        emergency_contact_person_number,
        password: hashedPassword,
      },
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ message: "Account created successfully", data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
