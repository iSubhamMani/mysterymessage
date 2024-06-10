import { dbConnect } from "@/lib/dbConnect";
import { UserModel } from "@/models/user.model";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/helpers/sendVerificationEmail";

export async function POST(request: Request) {
  await dbConnect();

  try {
    const { username, email, password } = await request.json();

    const existingUserVerifiedByUsername = await UserModel.findOne({
      username,
      isVerified: true,
    });

    if (existingUserVerifiedByUsername) {
      return Response.json(
        {
          success: false,
          message: "Username is already taken",
        },
        {
          status: 400,
        }
      );
    }

    const exisitingUserByEmail = await UserModel.findOne({ email });
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (exisitingUserByEmail) {
      if (exisitingUserByEmail.isVerified) {
        return Response.json(
          {
            success: false,
            message: "User with this email already exists",
          },
          {
            status: 400,
          }
        );
      } else {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 1);

        exisitingUserByEmail.password = hashedPassword;
        exisitingUserByEmail.verifyCode = verifyCode;
        exisitingUserByEmail.verifyCodeExpiry = expiryDate;

        await exisitingUserByEmail.save();
      }
    } else {
      // new user
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 1);

      const newUser = new UserModel({
        username,
        email,
        password: hashedPassword,
        verifyCode,
        verifyCodeExpiry: expiryDate,
        isVerified: false,
        isAcceptingMessage: true,
        messages: [],
      });

      await newUser.save();
    }

    const emailResponse = await sendVerificationEmail(
      email,
      username,
      verifyCode
    );

    if (!emailResponse.success) {
      return Response.json(
        {
          success: false,
          message: emailResponse.message,
        },
        {
          status: 500,
        }
      );
    }

    return Response.json(
      {
        success: true,
        message: "User registered successfully. Please verify your email",
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.log("Error registering error: ", error);
    return Response.json(
      {
        success: false,
        message: "Failed to register user",
      },
      {
        status: 500,
      }
    );
  }
}
