#include "Engine.h"

struct TestShapes : Screen
{
	TestShapes()
	{
		printf("hrmm\n");
		entities.push_back(Entity::circle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));
		entities.push_back(Entity::rectangle(Vector2(150.0f, 50.0f), Vector2(40.0f, 80.0f), 0xBB88FFFF));
		entities.push_back(Entity::circle(Vector2(50.0f, 150.0f), 2.0f, 0x999999FF));
		entities.push_back(Entity::text("Hello!", Vector2(50.0f, 150.0f), 20.0f, 0xFFFFFFFF));
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	printf("jhelms\n");
	Game game;
	//game.entities.push_back(Entity::circle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));
	std::shared_ptr<Screen> screen = std::shared_ptr<Screen>(new TestShapes());
	game.screen = screen;

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}